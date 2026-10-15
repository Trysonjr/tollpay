from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str = "mysql+pymysql://toll:toll@localhost:3306/toll?charset=utf8mb4"
    JWT_SECRET: str = "dev-secret-change-me"

    ACCESS_TOKEN_MINUTES: int = 60
    REFRESH_TOKEN_DAYS: int = 30

    OTP_EXPIRE_SECONDS: int = 300
    OTP_RESEND_COOLDOWN: int = 60
    OTP_HOURLY_LIMIT: int = 5
    OTP_MAX_ATTEMPTS: int = 5

    MOMO_EXPIRE_SECONDS: int = 300   # mobile-money prompt validity (5 min)

    model_config = {"env_file": ".env"}


settings = Settings()