import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../config/database.js";
import { pets, petActivities } from "../models/schema.js";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth.js";
import { z } from "zod";

const router: Router = Router();

// Validation schemas
const createPetSchema = z.object({
  name: z.string().min(1).max(50),
  species: z.string().min(1).max(50),
  breed: z.string().optional(),
  age: z.number().int().min(0).max(100).optional(),
});

const updatePetSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  species: z.string().min(1).max(50).optional(),
  breed: z.string().optional(),
  age: z.number().int().min(0).max(100).optional(),
  health: z.number().int().min(0).max(100).optional(),
  happiness: z.number().int().min(0).max(100).optional(),
  hunger: z.number().int().min(0).max(100).optional(),
  energy: z.number().int().min(0).max(100).optional(),
});

// Get all pets for the authenticated user
router.get("/", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const userPets = await db
      .select()
      .from(pets)
      .where(eq(pets.userId, req.user!.id));

    res.json({
      success: true,
      data: userPets,
    });
  } catch (error) {
    console.error("Get pets error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pets",
    });
  }
});

// Get a specific pet
router.get("/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const pet = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, req.params.id), eq(pets.userId, req.user!.id)))
      .limit(1);

    if (pet.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Pet not found",
      });
    }

    res.json({
      success: true,
      data: pet[0],
    });
  } catch (error) {
    console.error("Get pet error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pet",
    });
  }
});

// Create a new pet
router.post("/", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createPetSchema.parse(req.body);

    const newPet = await db
      .insert(pets)
      .values({
        ...validatedData,
        userId: req.user!.id,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newPet[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    console.error("Create pet error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create pet",
    });
  }
});

// Update a pet
router.put("/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = updatePetSchema.parse(req.body);

    const updatedPet = await db
      .update(pets)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(and(eq(pets.id, req.params.id), eq(pets.userId, req.user!.id)))
      .returning();

    if (updatedPet.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Pet not found",
      });
    }

    res.json({
      success: true,
      data: updatedPet[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }

    console.error("Update pet error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update pet",
    });
  }
});

// Delete a pet
router.delete("/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const deletedPet = await db
      .delete(pets)
      .where(and(eq(pets.id, req.params.id), eq(pets.userId, req.user!.id)))
      .returning();

    if (deletedPet.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Pet not found",
      });
    }

    res.json({
      success: true,
      message: "Pet deleted successfully",
    });
  } catch (error) {
    console.error("Delete pet error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete pet",
    });
  }
});

// Get pet activities
router.get("/:id/activities", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    // First verify the pet belongs to the user
    const pet = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, req.params.id), eq(pets.userId, req.user!.id)))
      .limit(1);

    if (pet.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Pet not found",
      });
    }

    const activities = await db
      .select()
      .from(petActivities)
      .where(eq(petActivities.petId, req.params.id))
      .orderBy(petActivities.createdAt);

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Get pet activities error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch pet activities",
    });
  }
});

// Add activity to pet
router.post("/:id/activities", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { activity, description } = req.body;

    if (!activity) {
      return res.status(400).json({
        success: false,
        error: "Activity is required",
      });
    }

    // First verify the pet belongs to the user
    const pet = await db
      .select()
      .from(pets)
      .where(and(eq(pets.id, req.params.id), eq(pets.userId, req.user!.id)))
      .limit(1);

    if (pet.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Pet not found",
      });
    }

    const newActivity = await db
      .insert(petActivities)
      .values({
        petId: req.params.id,
        activity,
        description,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newActivity[0],
    });
  } catch (error) {
    console.error("Add pet activity error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add pet activity",
    });
  }
});

export default router;
