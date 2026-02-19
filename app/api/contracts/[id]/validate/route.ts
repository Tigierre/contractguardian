/**
 * PATCH /api/contracts/[id]/validate
 *
 * Metadata validation endpoint.
 * Persists user-validated contract metadata and sets metadataValidatedAt timestamp.
 *
 * @module app/api/contracts/[id]/validate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/lib/db';
import { contracts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { MetadataValidationSchema } from '@/lib/ai/schemas';
import {
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  NotFoundError,
} from '@/lib/errors';
import { ZodError } from 'zod/v4';

/**
 * PATCH handler - Persist user-validated metadata
 *
 * Validates request body against MetadataValidationSchema,
 * updates contract in database, and sets metadataValidatedAt timestamp.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Parse contract ID
    const { id } = await params;
    const contractId = parseInt(id, 10);

    if (isNaN(contractId)) {
      throw new ValidationError('ID contratto non valido');
    }

    // Fetch contract from DB
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, contractId))
      .limit(1);

    if (!contract) {
      throw new NotFoundError('Contratto non trovato');
    }

    // Parse and validate request body
    const body = await req.json();
    const validated = MetadataValidationSchema.parse(body);

    // Update contract in DB
    const validatedAt = new Date();
    await db
      .update(contracts)
      .set({
        partyA: validated.partyA,
        partyB: validated.partyB,
        contractType: validated.contractType,
        jurisdiction: validated.jurisdiction,
        metadataValidatedAt: validatedAt,
        updatedAt: validatedAt,
      })
      .where(eq(contracts.id, contractId));

    // Return success
    return NextResponse.json(
      createSuccessResponse({
        contractId,
        metadata: validated,
        validatedAt,
      })
    );
  } catch (error: unknown) {
    console.error('[Validate] PATCH error:', error);

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!details[path]) details[path] = [];
        details[path].push(issue.message);
      });

      return NextResponse.json(
        createErrorResponse(
          new ValidationError('Dati di validazione non validi', details)
        ),
        { status: 400 }
      );
    }

    // Handle known errors
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(createErrorResponse(error), {
        status: error.statusCode,
      });
    }

    // Unknown error
    return NextResponse.json(
      createErrorResponse(new Error('Errore durante la validazione dei metadati')),
      { status: 500 }
    );
  }
}
