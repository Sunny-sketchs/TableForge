import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get DATABASE_URL from environment
database_url = os.getenv('DATABASE_URL')

# CRITICAL FIX: Check if DATABASE_URL is set
if not database_url:
    print("=" * 60)
    print("CRITICAL WARNING: DATABASE_URL environment variable is not set.")
    print("Database operations will fail.")
    print("=" * 60)
    # Provide a fallback for local development
    database_url = "postgresql://user:password@localhost:5432/tableforge_dev"
    print(f"Using fallback database URL for local development: {database_url}")

# RENDER FIX: Convert postgres:// to postgresql:// for SQLAlchemy compatibility
# Render provides DATABASE_URL in format: postgres://...
# But SQLAlchemy requires: postgresql://...
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
    print("✓ Converted Render database URL format for SQLAlchemy compatibility")

# Log connection info (without exposing password)
try:
    # Extract host from URL for logging (safely)
    if "@" in database_url:
        host_part = database_url.split("@")[1].split("/")[0]
        print(f"✓ Connecting to database at: {host_part}")
except Exception:
    pass

# Create the SQLAlchemy engine with production-ready settings
engine = create_engine(
    database_url,
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,   # Recycle connections after 1 hour
    echo=False,          # Set to True for SQL query logging in development
    connect_args={
        "connect_timeout": 10,  # 10 second timeout
        "options": "-c timezone=utc"  # Use UTC timezone
    }
)

# Configure the sessionmaker
sessionlocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for model definitions
Base = declarative_base()

# Test the database connection on import (optional, for debugging)
def test_connection():
    """Test database connection on startup"""
    try:
        with engine.connect() as connection:
            print("✓ Database connection successful!")
            return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

# Uncomment the line below to test connection on import
# test_connection()