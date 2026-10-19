import { sql, type Kysely } from 'kysely';

/**
 * Linhas de outros contextos que os testes do Ordering precisam (FKs e ACLs).
 * Inseridas por SQL para não depender dos repositórios do Catalog/Delivery.
 */
export async function insertProduct(
  db: Kysely<unknown>,
  {
    id,
    name = 'X-Burger Especial',
    price = '32.90',
    isAvailable = true,
    removed = false,
  }: { id: string; name?: string; price?: string; isAvailable?: boolean; removed?: boolean },
): Promise<void> {
  await sql`
    INSERT INTO products (id, name, description, price, category, is_available, preparation_time, deleted_at)
    VALUES (${id}, ${name}, 'Descrição de teste do produto', ${price}, 'meal', ${isAvailable}, 20,
            ${removed ? sql`now()` : null})
  `.execute(db);
}

export async function insertDeliveryPerson(
  db: Kysely<unknown>,
  {
    id,
    name = 'Carlos Santos',
    vehicleType = 'motorcycle',
    isActive = true,
    removed = false,
    userId = null,
  }: {
    id: string;
    name?: string;
    vehicleType?: 'bicycle' | 'motorcycle' | 'car';
    isActive?: boolean;
    removed?: boolean;
    /** Login do entregador (perfil `courier`). */
    userId?: string | null;
  },
): Promise<void> {
  await sql`
    INSERT INTO delivery_persons (id, name, phone, vehicle_type, is_active, current_latitude, current_longitude, user_id, deleted_at)
    VALUES (${id}, ${name}, '(11) 91234-5678', ${vehicleType}, ${isActive}, -23.5489, -46.6388, ${userId},
            ${removed ? sql`now()` : null})
  `.execute(db);
}
