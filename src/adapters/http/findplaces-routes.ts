import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { GoogleApiError } from '../google/google-api-error.js';
import type { GooglePlacesApiService } from '../google/google-places-api-service.js';
import type { NearbySearchQuery } from '../../application/ports/google-places-service.js';

const findPlacesBodySchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().finite().positive().max(50000)
}) satisfies z.ZodType<NearbySearchQuery>;

export function registerFindPlacesRoutes(app: Express, googlePlacesService: GooglePlacesApiService): void {
  app.post('/find-places', async (req: Request, res: Response) => {
    const parsedInput = findPlacesBodySchema.safeParse(req.body);
    if (!parsedInput.success) {
      res.status(400).json({
        error: 'invalid body: latitude, longitude, and radiusMeters are required'
      });
      return;
    }

    try {
      const result = await googlePlacesService.searchNearby(parsedInput.data);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof GoogleApiError) {
        res.status(error.statusCode).json({ error: 'places search unavailable' });
        return;
      }
      throw error;
    }
  });
}

