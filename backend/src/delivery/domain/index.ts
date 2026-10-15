export {
  DeliveryPerson,
  type DeliveryPersonDetails,
  type DeliveryPersonDetailsChanges,
  type DeliveryPersonSnapshot,
  type RegisterDeliveryPersonParams,
  type RemoveDeliveryPersonParams,
} from './delivery-person/delivery-person.js';
export { DeliveryPersonId } from './delivery-person/delivery-person-id.js';
export * from './delivery-person/errors/index.js';
export * from './delivery-person/events/index.js';
export type { DeliveryPersonRepository } from './delivery-person/repositories/delivery-person.repository.js';
export { PersonName } from './delivery-person/value-objects/person-name.js';
export { PhoneNumber } from './delivery-person/value-objects/phone-number.js';
export {
  VEHICLE_TYPES,
  VehicleType,
  type VehicleTypeValue,
} from './delivery-person/value-objects/vehicle-type.js';
export { solveMinCostAssignment } from './dispatch/algorithms/hungarian.js';
export { DispatchOptimizer } from './dispatch/services/dispatch-optimizer.js';
export {
  ASSIGNMENT_ALGORITHM,
  AssignmentPlan,
  type Assignment,
  type UnassignedOrder,
  type UnassignedReason,
} from './dispatch/value-objects/assignment-plan.js';
export { DispatchCandidate } from './dispatch/value-objects/dispatch-candidate.js';
export { DispatchableOrder } from './dispatch/value-objects/dispatchable-order.js';
export { OrderId } from './dispatch/value-objects/order-id.js';
export { InvalidGeoPointError } from './location/errors/invalid-geo-point.error.js';
export { EARTH_RADIUS_KM, GeoPoint, type GeoPointFields } from './location/geo-point.js';
