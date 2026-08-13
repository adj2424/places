import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { Logger } from '../../shared/logging/logger.js';
import type { GooglePlace, SearchQuery } from '../domain/google.js';
import type { PlacesService } from '../domain/port.js';

const findPlacesBodySchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().finite().positive().max(50000)
}) satisfies z.ZodType<SearchQuery>;

export type PlaceResponse = {
  id: string;
  name: string | null;
  address: string | null;
  phone: string | null;
};

function toPlaceResponse(place: GooglePlace): PlaceResponse {
  return {
    id: place.id,
    name: place.displayName?.text ?? null,
    address: place.formattedAddress ?? null,
    phone: place.nationalPhoneNumber ?? null
  };
}

export function registerPlacesRoutes(app: Express, placesService: PlacesService, logger: Logger): void {
  app.post('/find-places', async (req: Request, res: Response) => {
    const parsedInput = findPlacesBodySchema.safeParse(req.body);
    if (!parsedInput.success) {
      logger.warn('invalid request', {
        method: req.method,
        path: req.path,
        statusCode: 400,
        errors: parsedInput.error.errors
      });
      res.status(400).json({
        error: 'invalid body: latitude, longitude, and radiusMeters are required'
      });
      return;
    }

    try {
      const places = await placesService.getPlaces(parsedInput.data);
      res.status(200).json({ places: places.map(toPlaceResponse) });
    } catch (error) {
      logger.error('places search failed', { path: req.path, error: error });
      res.status(500).json({ error: 'places search unavailable' });
    }
  });
}

