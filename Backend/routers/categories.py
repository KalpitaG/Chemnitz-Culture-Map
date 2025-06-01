# Backend/routers/categories.py

from fastapi import APIRouter, HTTPException
from typing import List
from models import Category, CategoryType

router = APIRouter(
    prefix="/api/categories",
    tags=["categories"]
)

@router.get("", response_model=List[Category])
async def get_categories():
    """Get all cultural site categories"""
    try:
        categories = await Category.find_all().to_list()
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@router.get("/{category_name}")
async def get_category_by_name(category_name: CategoryType):
    """Get a specific category by name"""
    try:
        category = await Category.find_one(Category.name == category_name)
        if not category:
            raise HTTPException(status_code=404, detail=f"Category '{category_name}' not found")
        return category
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category name: {category_name}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch category: {str(e)}")
