from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.database.models import Base, LocalRecord

settings = get_settings()
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@dataclass
class Response:
    data: Any = None
    count: int | None = None


class Query:
    def __init__(self, client: "LocalClient", table_name: str):
        self.client, self.table_name = client, table_name
        self.filters: list[tuple[str, str, Any]] = []
        self.operation = "select"
        self.values: dict[str, Any] = {}
        self.fields = "*"
        self.single = False
        self.order_field: str | None = None
        self.descending = False
        self.limit_value: int | None = None

    def select(self, fields: str = "*", **_: Any): self.fields = fields; self.operation = "select"; return self
    def insert(self, values: dict | list[dict]): self.values = values if isinstance(values, dict) else {"__many__": values}; self.operation = "insert"; return self
    def update(self, values: dict): self.values = values; self.operation = "update"; return self
    def upsert(self, values: dict, **_: Any): self.values = values; self.operation = "upsert"; return self
    def eq(self, field: str, value: Any): self.filters.append((field, "eq", value)); return self
    def neq(self, field: str, value: Any): self.filters.append((field, "neq", value)); return self
    def is_(self, field: str, value: Any): self.filters.append((field, "is", value)); return self
    def in_(self, field: str, values: list[Any]): self.filters.append((field, "in", values)); return self
    def lt(self, field: str, value: Any): self.filters.append((field, "lt", value)); return self
    def gt(self, field: str, value: Any): self.filters.append((field, "gt", value)); return self
    def or_(self, expression: str):
        alternatives = []
        for part in expression.split(","):
            field, operator, value = part.split(".", 2)
            alternatives.append((field, operator, value))
        self.filters.append(("__or__", "or", alternatives))
        return self
    def order(self, field: str, desc: bool = False, **_: Any): self.order_field, self.descending = field, desc; return self
    def limit(self, value: int): self.limit_value = value; return self
    def maybe_single(self): self.single = True; self.limit_value = 1; return self
    def execute(self) -> Response:
        with self.client.session_factory.begin() as session:
            if self.operation in {"insert", "upsert"}:
                rows = self.values.get("__many__") if "__many__" in self.values else [self.values]
                output = []
                for values in rows:
                    record = self._find(session, values.get("id")) if self.operation == "upsert" else None
                    if record is None:
                        record = LocalRecord(record_id=str(values.get("id") or uuid4()), table_name=self.table_name, data={})
                        session.add(record)
                    record.data = {**record.data, **self._json(values), "id": record.record_id}
                    output.append(record.data)
                return Response(output)
            records = self._matching(session)
            if self.operation == "update":
                output = []
                for record in records:
                    record.data = {**record.data, **self._json(self.values)}
                    output.append(record.data)
                return Response(output)
            output = [record.data for record in records]
            return Response(output[0] if self.single and output else (None if self.single else output), len(output))

    def _find(self, session: Session, record_id: Any):
        if not record_id: return None
        return session.scalar(select(LocalRecord).where(LocalRecord.table_name == self.table_name, LocalRecord.record_id == str(record_id)))

    def _matching(self, session: Session):
        records = list(session.scalars(select(LocalRecord).where(LocalRecord.table_name == self.table_name)))
        def match(record):
            for field, op, expected in self.filters:
                if op == "or":
                    if not any(self._compare(record.data.get(item_field), item_op, item_value) for item_field, item_op, item_value in expected): return False
                    continue
                if not self._compare(record.data.get(field), op, expected): return False
            return True
        rows = [record for record in records if match(record)]
        if self.order_field: rows.sort(key=lambda row: str(row.data.get(self.order_field, "")), reverse=self.descending)
        return rows[: self.limit_value] if self.limit_value else rows

    @staticmethod
    def _compare(actual: Any, op: str, expected: Any) -> bool:
        if op == "eq": return str(actual) == str(expected)
        if op == "neq": return str(actual) != str(expected)
        if op == "in": return str(actual) in {str(value) for value in expected}
        if op == "is": return (expected == "null" and actual is None) or (expected != "null" and actual is not None)
        if op in {"lt", "gt"}:
            try:
                left, right = str(actual), str(expected)
                return left < right if op == "lt" else left > right
            except (TypeError, ValueError):
                return False
        return False

    @staticmethod
    def _json(values: dict) -> dict:
        return {key: (value.isoformat() if isinstance(value, datetime) else value) for key, value in values.items() if key != "id"}


class LocalClient:
    def __init__(self): self.session_factory = SessionLocal
    def table(self, table_name: str) -> Query: return Query(self, table_name)


def initialize_local_database() -> None:
    Base.metadata.create_all(engine)
