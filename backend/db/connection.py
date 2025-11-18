import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# CRITICAL FIX: Add a check for database_url
database_url = os.getenv('DATABASE_URL')
if not database_url:
    print("CRITICAL WARNING: DATABASE_URL environment variable is not set. Database operations will likely fail.")


# Create the SQLAlchemy engine
engine = create_engine(database_url)

# Configure the sessionmaker
sessionlocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for model definitions
Base = declarative_base()