CREATE TABLE "personal_study_course" (
 "id" TEXT PRIMARY KEY,
 "operatorId" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "total" INTEGER NOT NULL,
 "initialCompleted" INTEGER NOT NULL DEFAULT 0,
 "remainingHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
 CHECK ("initialCompleted" >= 0 AND "initialCompleted" <= "total")
);
CREATE UNIQUE INDEX "personal_study_course_operatorId_title_key" ON "personal_study_course"("operatorId", "title");
CREATE TABLE "personal_study_lesson" (
 "id" TEXT PRIMARY KEY,
 "courseId" TEXT NOT NULL REFERENCES "personal_study_course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "title" TEXT NOT NULL,
 "position" INTEGER NOT NULL,
 "completed" BOOLEAN NOT NULL DEFAULT false,
 "completedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "personal_study_lesson_courseId_position_key" ON "personal_study_lesson"("courseId", "position");
