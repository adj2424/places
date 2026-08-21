import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { Logger } from '../../shared/logging/logger.js';
import { PrimaryTypes, type GooglePlace, type PrimaryType } from '../domain/google.js';
import type { PlacesService } from '../domain/port.js';

type FindPlacesRequest = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  primaryTypes?: PrimaryType[];
};

type FindPlacesResponse = {
  places: {
    id: string;
    name?: string;
    address?: string;
    phone?: string;
    types?: string[];
    primaryType?: string;
  }[];
  total: number;
};

const findPlacesRequestSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  radiusMeters: z.number().finite().positive().max(50000),
  primaryTypes: z.array(z.enum(Object.keys(PrimaryTypes) as [PrimaryType, ...PrimaryType[]])).optional()
}) satisfies z.ZodType<FindPlacesRequest>;

export function registerPlacesRoutes(app: Express, placesService: PlacesService, logger: Logger): void {
  app.post('/find-places', async (req: Request, res: Response) => {
    const parsedInput = findPlacesRequestSchema.safeParse(req.body);
    if (!parsedInput.success) {
      logger.error(
        {
          method: req.method,
          path: req.path,
          statusCode: 400,
          errors: parsedInput.error.issues
        },
        'invalid request'
      );
      res.status(400).json({
        error: parsedInput.error.issues
      });
      return;
    }

    try {
      const { latitude, longitude, radiusMeters, primaryTypes } = parsedInput.data;
      const places = await placesService.getPlaces(latitude, longitude, radiusMeters, primaryTypes ?? []);
      const response = mapFindPlacesResponse(places);
      res.status(200).json(response);
      logger.info('found places with no website successfully');
    } catch (error) {
      logger.error({ error }, 'error finding places');
      throw new Error('this would be a route error mapped from domain error - finding places');
    }
  });
}

function mapFindPlacesResponse(places: GooglePlace[]): FindPlacesResponse {
  const ret = places.map(place => ({
    id: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber,
    types: place.types,
    primaryType: place.primaryType
  }));
  return { places: ret, total: places.length };
}
