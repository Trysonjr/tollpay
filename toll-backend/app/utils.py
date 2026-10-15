def paginate(query, page: int, limit: int):
    """Standard pagination used by all list endpoints."""
    page = max(1, page)
    limit = min(max(1, limit), 100)
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, {"page": page, "limit": limit, "total": total}