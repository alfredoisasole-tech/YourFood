/**
 * Préparation commune des tests backend.
 *
 * Les tests d'intégration avec base (`tests/db/`) ne tournent que si TEST_DATABASE_URL est définie :
 * ils vident la base avant chaque scénario, elle doit donc être dédiée aux tests.
 * Ex. : TEST_DATABASE_URL="postgresql://user:password@localhost:55432/mealapp_test?schema=public"
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_for_integration_testing_123456';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export {};
