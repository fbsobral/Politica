-- AlterTable
ALTER TABLE "User" ADD COLUMN     "quizAnswers" JSONB,
ADD COLUMN     "quizAt" TIMESTAMP(3),
ADD COLUMN     "quizWeights" JSONB;

