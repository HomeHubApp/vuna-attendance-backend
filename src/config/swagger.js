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