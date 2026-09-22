from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class MapSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    limit: int = Field(default=5, ge=1, le=10)


class ReverseGeocodeRequest(Coordinate):
    pass


class RouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate


class NearestRequest(Coordinate):
    radius_km: float = Field(default=50, gt=0, le=500)
