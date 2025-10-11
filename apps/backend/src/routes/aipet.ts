import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Pet recommendations endpoint
router.post('/recommendations', authenticateToken, [
  body('scene_data').isArray().withMessage('Scene data must be an array'),
  body('pet_data').isObject().withMessage('Pet data must be an object'),
  body('pet_data.hungry').isNumeric().withMessage('Pet hungry level must be a number'),
  body('pet_data.tiredness').isNumeric().withMessage('Pet tiredness level must be a number'),
  body('pet_data.boredom').isNumeric().withMessage('Pet boredom level must be a number'),
  body('pet_data.toilet').isNumeric().withMessage('Pet toilet level must be a number'),
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { scene_data, pet_data } = req.body;
    const { model } = req.query;

    // Mock AI recommendation logic
    // In a real implementation, this would call an AI service
    const recommendations = generateMockRecommendations(pet_data, scene_data, model as string);

    res.json(recommendations);
  } catch (error) {
    next(error);
  }
});

// Mock recommendation generator
function generateMockRecommendations(petData: any, sceneData: any[], model?: string) {
  const { hungry, tiredness, boredom, toilet } = petData;
  
  // Simple logic to determine what the pet needs most
  let action = null;
  let movement: [number, number, number] | null = null;
  let reasoning = '';

  if (hungry > 0.7) {
    action = 'feed';
    movement = findNearestObject(sceneData, 'food');
    reasoning = 'Pet is very hungry and needs food immediately';
  } else if (toilet > 0.8) {
    action = 'toilet';
    movement = findNearestObject(sceneData, 'toilet');
    reasoning = 'Pet urgently needs to use the toilet';
  } else if (tiredness > 0.7) {
    action = 'sleep';
    movement = findNearestObject(sceneData, 'bed');
    reasoning = 'Pet is very tired and needs to rest';
  } else if (boredom > 0.6) {
    action = 'play';
    movement = findNearestObject(sceneData, 'toy');
    reasoning = 'Pet is bored and wants to play';
  } else {
    // Pet is content, maybe move to center or stay put
    movement = [0, 0, 0];
    reasoning = 'Pet is content and doesn\'t need immediate attention';
  }

  return {
    movement,
    action,
    reasoning,
    model: model || 'mock-model-v1',
    timestamp: new Date().toISOString(),
  };
}

// Helper function to find nearest object of a specific type
function findNearestObject(sceneData: any[], type: string): [number, number, number] | null {
  const objectsOfType = sceneData.filter(obj => obj.type === type);
  
  if (objectsOfType.length === 0) {
    return null;
  }

  // Return the position of the first object of the requested type
  // In a real implementation, you might calculate the actual nearest one
  const nearestObject = objectsOfType[0];
  return nearestObject.position || [0, 0, 0];
}

// Get pet status endpoint
router.get('/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // Mock pet status - in a real app, this would come from a database
    const petStatus = {
      hungry: Math.random() * 0.5 + 0.2, // 0.2 to 0.7
      tiredness: Math.random() * 0.4 + 0.1, // 0.1 to 0.5
      boredom: Math.random() * 0.6 + 0.1, // 0.1 to 0.7
      toilet: Math.random() * 0.3 + 0.1, // 0.1 to 0.4
      happiness: Math.random() * 0.3 + 0.6, // 0.6 to 0.9
      last_updated: new Date().toISOString(),
    };

    res.json(petStatus);
  } catch (error) {
    next(error);
  }
});

// Update pet status endpoint
router.post('/status', authenticateToken, [
  body('hungry').optional().isFloat({ min: 0, max: 1 }).withMessage('Hungry must be between 0 and 1'),
  body('tiredness').optional().isFloat({ min: 0, max: 1 }).withMessage('Tiredness must be between 0 and 1'),
  body('boredom').optional().isFloat({ min: 0, max: 1 }).withMessage('Boredom must be between 0 and 1'),
  body('toilet').optional().isFloat({ min: 0, max: 1 }).withMessage('Toilet must be between 0 and 1'),
  body('happiness').optional().isFloat({ min: 0, max: 1 }).withMessage('Happiness must be between 0 and 1'),
], async (req: AuthRequest, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    // In a real implementation, this would update the pet status in the database
    const updatedStatus = {
      ...req.body,
      last_updated: new Date().toISOString(),
    };

    res.json({
      message: 'Pet status updated successfully',
      status: updatedStatus,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
