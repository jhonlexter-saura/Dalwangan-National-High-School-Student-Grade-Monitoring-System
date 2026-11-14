# DNHS-SGMS Feature Update

## 1. Add ToastProvider

Import:
```jsx
import { ToastProvider } from "./context/ToastContext";
```

Wrap the application at the same level where AuthProvider is already used:
```jsx
<AuthProvider>
  <ToastProvider>
    <App />
  </ToastProvider>
</AuthProvider>
```

## 2. server/routes/activities.js

In POST `/`, accept `gradingCategory`:
```js
const {
  title,
  description,
  classId,
  academicPeriodId,
  type,
  gradingCategory,
  totalPoints,
  date,
} = req.body;
```

Resolve a default category so older callers remain compatible:
```js
const defaultCategoryByType = {
  quiz: "written_work",
  assignment: "written_work",
  project: "performance_task",
  performance_task: "performance_task",
  exam: "assessment",
  activity: "written_work",
};

const resolvedGradingCategory =
  gradingCategory || defaultCategoryByType[type];

if (!resolvedGradingCategory) {
  return res.status(400).json({
    error: "A valid grading category is required",
  });
}
```

Then include it in `Activity.create()`:
```js
const activity = await Activity.create({
  title: title.trim(),
  description: description?.trim() || "",
  class: classId,
  academicPeriod: academicPeriodId,
  type,
  gradingCategory: resolvedGradingCategory,
  totalPoints: Number(totalPoints),
  date,
});
```

## 3. server/routes/classes.js

In the teacher POST `/teacher/:userId`, accept `gradingSystem`:
```js
const {
  name,
  section,
  gradeLevel,
  schoolYear,
  gradingSystem,
} = req.body;
```

Normalize it before creating the class:
```js
const normalizedGradingSystem = gradingSystem?.enabled
  ? {
      enabled: true,
      components: gradingSystem.components || [],
    }
  : {
      enabled: false,
      components: [],
    };
```

Validate automatic grading percentages:
```js
if (normalizedGradingSystem.enabled) {
  const totalPercentage = normalizedGradingSystem.components.reduce(
    (sum, component) => sum + Number(component.percentage || 0),
    0
  );

  if (totalPercentage !== 100) {
    return res.status(400).json({
      error: "Grading percentages must total 100%",
    });
  }
}
```

Then add it to `Class.create()`:
```js
const newClass = await Class.create({
  name: name.trim(),
  section: section.trim(),
  gradeLevel: Number(gradeLevel),
  teacher: teacher._id,
  schoolYear: schoolYear.trim(),
  students: [],
  gradingSystem: normalizedGradingSystem,
});
```

## 4. Existing activities

Old activities created before `gradingCategory` was introduced may not have this field. They can still be read, but any future update/save should assign a category first. New activities created through the updated Teacher Activities page will always include one.

## 5. Automatic grade calculation foundation

The class now stores the grading percentages and each activity stores its grading category. The next grade-calculation step should calculate each category from raw scores:

category percentage score = total earned points / total possible points × 100

weighted contribution = category percentage score × class category weight / 100

final grade = sum of weighted contributions

This calculation should be implemented in the grade/grades service rather than stored as a manually entered value.
