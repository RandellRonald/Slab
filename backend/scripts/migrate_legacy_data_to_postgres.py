from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.database.local import Base as AuthBase
from app.database.local import User
from app.database.models import Base as RecordsBase
from app.database.models import LocalRecord


@dataclass
class MigrationCounts:
    users: int = 0
    records: int = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate SLAB legacy development data into PostgreSQL.")
    parser.add_argument("--source-url", required=True, help="SQLAlchemy URL for the preserved legacy source database.")
    parser.add_argument("--create-schema", action="store_true", help="Create missing target tables before importing data.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = get_settings()
    source_engine = create_engine(args.source_url, pool_pre_ping=True)
    target_engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

    if args.create_schema:
        AuthBase.metadata.create_all(target_engine)
        RecordsBase.metadata.create_all(target_engine)

    source_session = sessionmaker(bind=source_engine, autoflush=False, expire_on_commit=False)
    target_session = sessionmaker(bind=target_engine, autoflush=False, expire_on_commit=False)

    counts = MigrationCounts()
    with source_session() as source, target_session.begin() as target:
        for source_user in source.scalars(select(User)).all():
            target_user = target.get(User, source_user.id)
            values = {
                "email": source_user.email,
                "password_hash": source_user.password_hash,
                "full_name": source_user.full_name,
                "phone": source_user.phone,
                "role": source_user.role,
                "is_active": source_user.is_active,
                "created_at": source_user.created_at,
            }
            if target_user is None:
                target.add(User(id=source_user.id, **values))
            else:
                for key, value in values.items():
                    setattr(target_user, key, value)
            counts.users += 1

        for source_record in source.scalars(select(LocalRecord)).all():
            target_record = target.scalar(
                select(LocalRecord).where(
                    LocalRecord.table_name == source_record.table_name,
                    LocalRecord.record_id == source_record.record_id,
                )
            )
            values: dict[str, Any] = {
                "internal_id": source_record.internal_id,
                "record_id": source_record.record_id,
                "table_name": source_record.table_name,
                "data": source_record.data,
                "created_at": source_record.created_at,
                "updated_at": source_record.updated_at,
            }
            if target_record is None:
                target.add(LocalRecord(**values))
            else:
                target_record.data = source_record.data
                target_record.created_at = source_record.created_at
                target_record.updated_at = source_record.updated_at
            counts.records += 1

    print(f"migrated users={counts.users} records={counts.records}")


if __name__ == "__main__":
    main()
