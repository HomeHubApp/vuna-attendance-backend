/**
 * @file Builds the OpenAPI spec `/api-docs` serves, by scanning every route
 * file's `@swagger` JSDoc comments.
 */
import swaggerJsdoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Veritas Attendance System API",
            version: "1.0.0",
            description: "Authentication module — students, staff, and monitors",
        },
        servers: [
            { url: "http://localhost:8000/api", description: "Local dev" },
        ],
        paths: {
            "/health": {
                get: {
                    summary: "Check API health",
                    tags: ["System"],
                    servers: [
                        { url: "http://localhost:8000", description: "Local dev" },
                    ],
                    responses: {
                        200: {
                            description: "API is healthy",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: {
                                                type: "string",
                                                example: "ok",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "access_token",
                },
            },
        },
    },
    // Every route file — under src/auth, admin, lecturer, student and shared — is named
    // <feature>Routes.js and carries the @swagger comments for its endpoints. (This
    // used to point at ./src/routes/*.js, which stopped matching anything when the
    // code was regrouped, leaving /api-docs empty.)
    apis: ["./src/**/*Routes.js"],
};

export const swaggerSpec = swaggerJsdoc(options);