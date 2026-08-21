import * as adminController from "../controllers/adminController.js";
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const adminRouter = Router();

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users (students, lecturers, monitors, admins) with roles, department, and pagination
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [Student, Lecturer, Monitor, Admin]
 *         description: Filter to only users holding this role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Case-insensitive match against name, institution identifier, or email
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of users per page
 *     responses:
 *       200:
 *         description: Paginated list of users with role, department, and status info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                         example: Chibuike Okafor
 *                       institution_identifier:
 *                         type: string
 *                         example: VUG/SEN/22/0467
 *                       email:
 *                         type: string
 *                         nullable: true
 *                       department:
 *                         type: string
 *                         nullable: true
 *                         example: Software Engineering
 *                       detail:
 *                         type: string
 *                         nullable: true
 *                         description: Level for students (e.g. "300 Level"), employment type for staff
 *                       status:
 *                         type: string
 *                         enum: [PENDING, ACTIVE, INACTIVE, SUSPENDED]
 *                       roles:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             role:
 *                               type: string
 *                             scope_type:
 *                               type: string
 *                               nullable: true
 *                             scope_id:
 *                               type: string
 *                               nullable: true
 *                       email_verified:
 *                         type: boolean
 *                       is_default_password:
 *                         type: boolean
 *                       last_login_at:
 *                         type: string
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                 counts:
 *                   type: object
 *                   description: Total count per role, unaffected by role/search filters — powers tab badges
 *                   properties:
 *                     Student:
 *                       type: integer
 *                     Lecturer:
 *                       type: integer
 *                     Monitor:
 *                       type: integer
 *                     Admin:
 *                       type: integer
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                       description: Total matching users after role/search filters, before pagination
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: Database error
 */
adminRouter.get("/users", requireAuth, requireRole("Admin"), adminController.getAllUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   patch:
 *     summary: Update an existing user (partial update)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:
 *                 type: string
 *                 description: User's full name
 *               institution_identifier:
 *                 type: string
 *                 description: Institution identifier (e.g. student/staff ID)
 *               email:
 *                 type: string
 *                 description: User's email address
 *               department_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the department to assign to the user
 *               status:
 *                 type: string
 *                 enum: [PENDING, ACTIVE, INACTIVE, SUSPENDED]
 *                 description: User's account status
 *             description: All fields are optional (partial update). Only provided fields will be updated.
 *     responses:
 *       200:
 *         description: Updated user with resolved department and role information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 institution_identifier:
 *                   type: string
 *                 email:
 *                   type: string
 *                   nullable: true
 *                 department:
 *                   type: string
 *                   nullable: true
 *                 detail:
 *                   type: string
 *                   nullable: true
 *                 status:
 *                   type: string
 *                   enum: [PENDING, ACTIVE, INACTIVE, SUSPENDED]
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                       scope_type:
 *                         type: string
 *                         nullable: true
 *                       scope_id:
 *                         type: string
 *                         nullable: true
 *                 email_verified:
 *                   type: boolean
 *                 is_default_password:
 *                   type: boolean
 *                 last_login_at:
 *                   type: string
 *                   nullable: true
 *                 created_at:
 *                   type: string
 *       400:
 *         description: Bad request (missing ID or no valid fields provided)
 *       404:
 *         description: User not found
 *       500:
 *         description: Database error
 */
adminRouter.patch("/users/:id",requireAuth, requireRole("Admin"), adminController.updateUser);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     summary: Delete a user permanently
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The ID of the user to delete
 *     responses:
 *       200:
 *         description: User successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User successfully deleted
 *                 deletedUser:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     institution_identifier:
 *                       type: string
 *                     email:
 *                       type: string
 *                       nullable: true
 *                     department:
 *                       type: string
 *                       nullable: true
 *                     detail:
 *                       type: string
 *                       nullable: true
 *                     status:
 *                       type: string
 *                       enum: [PENDING, ACTIVE, INACTIVE, SUSPENDED]
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           scope_type:
 *                             type: string
 *                             nullable: true
 *                           scope_id:
 *                             type: string
 *                             nullable: true
 *                     email_verified:
 *                       type: boolean
 *                     is_default_password:
 *                       type: boolean
 *                     last_login_at:
 *                       type: string
 *                       nullable: true
 *                     created_at:
 *                       type: string
 *       400:
 *         description: Bad request (missing ID, or deletion failed due to foreign key constraints)
 *       404:
 *         description: User not found
 *       500:
 *         description: Database error
 */
adminRouter.delete("/users/:id",requireAuth, requireRole("Admin"), adminController.deleteUser);

export default adminRouter;