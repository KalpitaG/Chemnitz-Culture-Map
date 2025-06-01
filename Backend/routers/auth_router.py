# Backend/routers/auth_router.py

from fastapi import APIRouter, HTTPException, Depends, status
from datetime import timedelta, datetime

from auth import AuthService, UserCreate, UserLogin, Token, UserResponse, get_current_user
from models import User
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"]
)

@router.post("/register", response_model=Token)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    try:
        existing_user = await User.find_one(User.email == user_data.email)
        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

        hashed_password = AuthService.get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            password_hash=hashed_password,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            is_active=True,
            is_admin=False
        )
        await user.save()

        access_token_expires = timedelta(minutes=30)
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        user_response = UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at
        )

        return Token(access_token=access_token, token_type="bearer", user=user_response)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to register user: {str(e)}")

@router.post("/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    """Login user and return JWT token"""
    try:
        user = await User.find_one(User.email == user_credentials.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not AuthService.verify_password(user_credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

        access_token_expires = timedelta(minutes=30)
        access_token = AuthService.create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        user.last_login = datetime.utcnow()
        await user.save()

        user_response = UserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            created_at=user.created_at
        )

        return Token(access_token=access_token, token_type="bearer", user=user_response)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Login failed: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at
    )

@router.post("/logout")
async def logout_user():
    """Logout user (client should delete token)"""
    return {"message": "Successfully logged out"}

@router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    """Example protected endpoint"""
    return {
        "message": f"Hello {current_user.first_name}! This is a protected route.",
        "user_id": str(current_user.id),
        "email": current_user.email
    }
