from rest_framework.pagination import PageNumberPagination


def paginate(queryset, request, serializer_class, page_size=5):
    paginator = PageNumberPagination()
    paginator.page_size = page_size
    page = paginator.paginate_queryset(queryset, request)
    serializer = serializer_class(page, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)
