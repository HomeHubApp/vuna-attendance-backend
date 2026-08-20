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
    apis: ["./src/routes/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);