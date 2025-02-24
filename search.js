require('dotenv').config();
const { MongoClient } = require('mongodb');
const axios = require('axios');
const https = require('https');

// ################################
// # CONFIGURATION & INITIALIZATION 
// ################################

// Azure OpenAI configurations
// Using text-embedding-3-small model for optimal performance and cost balance
const endpoint = process.env.AZURE_ENDPOINT_URL;
const apiKey = process.env.AZURE_API_KEY;
const deploymentName = "text-embedding-3-small";

// MongoDB configuration
// Optimized connection pool settings for production workloads:
// - maxPoolSize: Limits maximum concurrent connections
// - minPoolSize: Maintains minimum connections for faster response
// - maxIdleTimeMS: Closes idle connections to save resources
// - connectTimeoutMS: Fails fast on connection issues
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    connectTimeoutMS: 5000
});

// HTTPS Agent Configuration
// Optimized for high-throughput scenarios with connection pooling
const agent = new https.Agent({ 
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 5000
});

// Axios Instance Configuration
// Pre-configured with headers and timeout for Azure OpenAI API calls
const axiosInstance = axios.create({
    httpsAgent: agent,
    timeout: 3000,
    headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
    }
});

// #############################
// # CORE FUNCTIONS
// #############################

/**
 * Generates embeddings for input text using Azure OpenAI
 * @param {string} text - Input text to generate embedding for
 * @returns {Promise<Array<number>>} Vector embedding
 * @throws {Error} If embedding generation fails
 */
async function getEmbedding(text) {
    try {
        const response = await axiosInstance.post(
            `${endpoint}openai/deployments/${deploymentName}/embeddings?api-version=2023-05-15`,
            { input: text }
        );
        return response.data.data[0].embedding;
    } catch (error) {
        console.error('Embedding error:', error.message);
        throw error;
    }
}

/**
 * Performs semantic search on FAQs using vector similarity
 * @param {string} queryText - Search query text
 * @returns {Promise<Array<Object>>} Matching FAQ documents with similarity scores
 * @throws {Error} If search operation fails
 */
async function searchFAQs(queryText) {
    try {
        const queryVector = await getEmbedding(queryText);

        return await client.db("knowledge_base")
            .collection("faqs")
            .aggregate([
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "path": "embedding",
                        "queryVector": queryVector,
                        "numCandidates": 5,
                        "limit": 2
                    }
                },
                {
                    "$project": {
                        "question": 1,
                        "answer": 1,
                        "score": { "$meta": "vectorSearchScore" },
                        "_id": 0
                    }
                }
            ]).toArray();

    } catch (error) {
        console.error("Search error:", error.message);
        throw error;
    }
}

// ################################
// # MAIN EXECUTION & PERFORMANCE MONITORING
// ################################

/**
 * Main execution function that:
 * 1. Connects to MongoDB
 * 2. Performs a sample search
 * 3. Measures and logs performance metrics
 * 4. Displays search results
 * 5. Closes database connection
 */
async function main() {
    try {
        await client.connect();

        const queryText = "Enter your query here...";
        console.log("Query:", queryText);
        console.log("\nPerformance Metrics:");
        console.log("-------------------");

        // Measure embedding generation time
        const embeddingStart = performance.now();
        const embedding = await getEmbedding(queryText);
        const embeddingTime = performance.now() - embeddingStart;

        // Measure search time
        const searchStart = performance.now();
        const results = await searchFAQs(queryText);
        const searchTime = performance.now() - searchStart;

        // Calculate total operation time
        const totalTime = embeddingTime + searchTime;

        // Display results
        console.log(`Embedding Time: ${embeddingTime.toFixed(2)}ms`);
        console.log(`Search Time: ${searchTime.toFixed(2)}ms`);
        console.log(`Total Processing Time: ${totalTime.toFixed(2)}ms`);
        console.log("-------------------\n");

        if (results.length > 0) {
            console.log("Search Results:");
            console.log("---------------");
            results.forEach((result, index) => {
                console.log(`\nMatch ${index + 1}:`);
                console.log("Q:", result.question);
                console.log("A:", result.answer);
                console.log("Similarity Score:", result.score.toFixed(4));
            });
        } else {
            console.log("No matches found");
        }

        // Log performance summary
        console.log("\nPerformance Summary:");
        console.log("-------------------");
        console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`→ Embedding: ${((embeddingTime/totalTime)*100).toFixed(1)}%`);
        console.log(`→ Search: ${((searchTime/totalTime)*100).toFixed(1)}%`);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await client.close();
    }
}

main().catch(console.error);

// ################################
// # VECTOR INDEX CONFIGURATION
// ################################

/*
MongoDB Vector Search Index Definition:
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "dotProduct"
    }
  ]
}

Note: This index configuration enables efficient similarity search 
using dot product as the similarity measure. The embedding dimension (1536)
matches the output of the text-embedding-3-small model.
*/
