import "dotenv/config";
import { supabaseAdmin } from "../config/supabase.js";
import * as authService from "../services/authService.js";

async function seed() {
    console.log("Starting seed...\n");

    const { data: department, error: deptError } = await supabaseAdmin
        .from("departments")
        .select("id, name")
        .eq("abbreviation", "SWE")
        .single();

    if (deptError || !department) {
        console.error("Could not find Software Engineering department. Did you run the departments seed SQL first?");
        return;
    }
    console.log(`Using department: ${department.name}\n`);

    const testUsers = [
        {
            full_name: "Test Student",
            institution_identifier: "VUG/SWE/24/001",
            role: "Student",
            department_id: department.id,
        },
        {
            full_name: "Test Lecturer",
            institution_identifier: "STF/SWE/001",
            role: "Lecturer",
            department_id: department.id,
        },
        {
            full_name: "Test HOD",
            institution_identifier: "STF/SWE/002",
            role: "Monitor",
            department_id: department.id,    
            scope_type: "DEPARTMENT",
        },
        {
            full_name: "Test QA",
            institution_identifier: "STF/QA/001",
            role: "Monitor",
            department_id: null,              
            scope_type: "UNIVERSITY",
        },
    ];

    const createdCredentials = [];

    for (const testUser of testUsers) {
        try {
            const user = await authService.adminCreateUser(testUser);

            console.log(`Created ${testUser.role}: ${testUser.institution_identifier}`);

            createdCredentials.push({
                role: testUser.role,
                identifier: testUser.institution_identifier,
                password: user.default_password,
            });
        } catch (error) {
            console.error(`Failed to create ${testUser.full_name}:`, error.message);
        }
    }

    console.log("\nTest account credentials:\n");
    console.table(createdCredentials);
}

seed();