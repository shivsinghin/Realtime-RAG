# CODE TO GENERATE AND STORE EMBEDDINGS

import os
from dotenv import load_dotenv
from pymongo import MongoClient
import openai

# Load environment variables
load_dotenv()

# MongoDB setup
mongodb_uri = os.getenv('MONGODB_URI')
client = MongoClient(mongodb_uri)
db = client['knowledge_base']  # database name
collection = db['faqs']  # collection name

# Azure OpenAI setup
openai.api_type = "azure"
openai.api_key = os.getenv('AZURE_API_KEY')
openai.api_base = os.getenv('AZURE_ENDPOINT_URL')
openai.api_version = "2023-05-15"

# All FAQs Documents cheunks
faqs = [
    {
        "question": "xxxxxxxxxxxxxx",
        "answer": "xxxxxxxxxxxxxx"
    },
    {
        "question": "xxxxxxxxxxxxxx",
        "answer": "xxxxxxxxxxxxxx"
    },
    {
        "question": "xxxxxxxxxxxxxx",
        "answer": "xxxxxxxxxxxxxx"
    },
    
]

# Process and store each FAQ
for faq in faqs:
    # Get embedding for the question
    response = openai.Embedding.create(
        input=faq["question"],
        engine="text-embedding-3-small"
    )
    embedding = response['data'][0]['embedding']

    # Create document
    doc = {
        "question": faq["question"],
        "answer": faq["answer"],
        "embedding": embedding
    }

    # Store in MongoDB
    result = collection.insert_one(doc)
    print(f"Document inserted with id: {result.inserted_id}")

# Create vector search index (run this once)
try:
    collection.create_index([("embedding", "2dsphere")])
    print("Vector search index created successfully")
except Exception as e:
    print(f"Error creating index: {e}")