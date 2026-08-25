import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import type { Logger } from '../../shared/logging/logger.js';
import { PrimaryTypes, type GooglePlace, type PrimaryType } from '../domain/google-places.js';
import type { PlacesService } from '../domain/port.js';
import type { Coordinates } from '../domain/coordinates.js';

type FindPlacesRequest = {
  address?: string;
  latitude?: number;
  longitude?: number;
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

const findPlacesRequestSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
    radiusMeters: z.number().finite().positive().max(50000),
    address: z.string().optional(),
    primaryTypes: z.array(z.enum(Object.keys(PrimaryTypes) as [PrimaryType, ...PrimaryType[]])).optional()
  })
  .superRefine((data, ctx) => {
    if (isAddressRequest(data) || isCoordinatesRequest(data)) {
      return;
    }

    const hasAddress = (data.address?.trim() ?? '').length > 0;
    const hasLatitude = data.latitude !== undefined;
    const hasLongitude = data.longitude !== undefined;

    if (hasAddress && (hasLatitude || hasLongitude)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'both address and coordinates are provided'
      });
      return;
    }

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude', 'longitude'],
        message: 'either address or coordinates are required'
      });
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'neither address nor coordinates are provided'
    });
  }) satisfies z.ZodType<FindPlacesRequest>;

function isAddressRequest(data: FindPlacesRequest): boolean {
  return (data.address?.trim() ?? '').length > 0 && data.latitude === undefined && data.longitude === undefined;
}

function isCoordinatesRequest(data: FindPlacesRequest): boolean {
  return data.latitude !== undefined && data.longitude !== undefined && (data.address?.trim() ?? '').length === 0;
}

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

    const request = parsedInput.data;
    let coordinates: Coordinates;
    try {
      if (isAddressRequest(request)) {
        coordinates = await placesService.getCoordinatesByAddress(request.address!);
        logger.info({ coordinates }, 'address transformed to coordinates');
      } else {
        coordinates = { latitude: request.latitude!, longitude: request.longitude! };
      }
    } catch (error) {
      logger.error({ error }, 'error getting coordinates');
      throw new Error('this would be a route error mapped from domain error - finding places');
    }
    // return res.status(200).json({ coordinates });

    try {
      const places = await placesService.getPlaces(coordinates, request.radiusMeters, request.primaryTypes ?? []);
      res.status(200).json(mapFindPlacesResponse(places));
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
