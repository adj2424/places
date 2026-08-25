export type GooglePlace = {
  id: string;
  types?: string[];
  primaryType?: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

export type GooglePlacesResponse = {
  places?: GooglePlace[];
};

const automotive = [
  'car_dealer',
  'car_rental',
  'car_repair',
  'car_wash',
  'ebike_charging_station',
  'electric_vehicle_charging_station',
  'gas_station',
  'parking',
  'parking_garage',
  'parking_lot',
  'rest_stop',
  'tire_shop',
  'truck_dealer'
];

const business = [
  'business_center',
  'corporate_office',
  'coworking_space',
  'farm',
  'manufacturer',
  'ranch',
  'supplier',
  'television_studio'
];

const culture = [
  'art_gallery',
  'art_museum',
  'art_studio',
  'auditorium',
  'castle',
  'cultural_landmark',
  'fountain',
  'historical_place',
  'history_museum',
  'monument',
  'museum',
  'performing_arts_theater',
  'sculpture'
];

const education = [
  'academic_department',
  'educational_institution',
  'library',
  'preschool',
  'primary_school',
  'research_institute',
  'school',
  'secondary_school',
  'university'
];

const entertainmentAndRecreation = [
  'park',
  'tourist_attraction',
  'amusement_park',
  'movie_theater',
  'night_club',
  'event_venue',
  'aquarium',
  'zoo',
  'casino',
  'botanical_garden',
  'bowling_alley',
  'concert_hall',
  'community_center',
  'national_park',
  'marina',
  'video_arcade'
];

const facilities = ['public_bath', 'public_bathroom', 'stable'];

const finance = ['accounting', 'atm', 'bank'];

const foodAndDrink = [
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'coffee_shop',
  'fast_food_restaurant',
  'pub',
  'ice_cream_shop',
  'meal_takeaway',
  'meal_delivery',
  'pizza_restaurant',
  'american_restaurant',
  'chinese_restaurant',
  'italian_restaurant',
  'japanese_restaurant',
  'mexican_restaurant'
];

const geographicalAreas = [
  'administrative_area_level_1',
  'administrative_area_level_2',
  'country',
  'locality',
  'postal_code',
  'school_district'
];

const government = [
  'city_hall',
  'courthouse',
  'embassy',
  'fire_station',
  'government_office',
  'local_government_office',
  'neighborhood_police_station',
  'police',
  'post_office'
];

const healthAndWellness = [
  'hospital',
  'pharmacy',
  'doctor',
  'dentist',
  'medical_clinic',
  'medical_center',
  'drugstore',
  'spa',
  'yoga_studio',
  'massage',
  'wellness_center',
  'dental_clinic',
  'general_hospital',
  'physiotherapist',
  'chiropractor',
  'skin_care_clinic'
];

const housing = ['apartment_building', 'apartment_complex', 'condominium_complex', 'housing_complex'];

const lodging = [
  'hotel',
  'motel',
  'resort_hotel',
  'lodging',
  'hostel',
  'bed_and_breakfast',
  'guest_house',
  'extended_stay_hotel',
  'campground',
  'rv_park',
  'inn',
  'cottage',
  'camping_cabin',
  'mobile_home_park',
  'japanese_inn',
  'farmstay'
];

const naturalFeatures = [
  'beach',
  'island',
  'lake',
  'mountain_peak',
  'nature_preserve',
  'river',
  'scenic_spot',
  'woods'
];

const placesOfWorship = ['buddhist_temple', 'church', 'hindu_temple', 'mosque', 'shinto_shrine', 'synagogue'];

const services = [
  'beauty_salon',
  'hair_salon',
  'laundry',
  'lawyer',
  'locksmith',
  'electrician',
  'plumber',
  'real_estate_agency',
  'insurance_agency',
  'florist',
  'travel_agency',
  'veterinary_care',
  'courier_service',
  'moving_company',
  'storage',
  'child_care_agency'
];

const shopping = [
  'store',
  'supermarket',
  'shopping_mall',
  'convenience_store',
  'clothing_store',
  'grocery_store',
  'department_store',
  'electronics_store',
  'hardware_store',
  'home_goods_store',
  'furniture_store',
  'book_store',
  'liquor_store',
  'pet_store',
  'shoe_store',
  'discount_store'
];

const sports = [
  'gym',
  'fitness_center',
  'stadium',
  'arena',
  'golf_course',
  'sports_complex',
  'sports_club',
  'playground',
  'swimming_pool',
  'tennis_court',
  'ski_resort',
  'ice_skating_rink',
  'athletic_field',
  'sports_activity_location',
  'race_course',
  'fishing_charter'
];

const transportation = [
  'airport',
  'international_airport',
  'train_station',
  'bus_station',
  'bus_stop',
  'subway_station',
  'transit_station',
  'transit_stop',
  'light_rail_station',
  'ferry_terminal',
  'taxi_stand',
  'taxi_service',
  'bike_sharing_station',
  'park_and_ride',
  'transportation_service',
  'bridge'
];

export const PrimaryTypes = {
  automotive,
  business,
  culture,
  education,
  entertainmentAndRecreation,
  facilities,
  finance,
  foodAndDrink,
  geographicalAreas,
  government,
  healthAndWellness,
  housing,
  lodging,
  naturalFeatures,
  placesOfWorship,
  services,
  shopping,
  sports,
  transportation
} as const;

export type PrimaryType = keyof typeof PrimaryTypes;
