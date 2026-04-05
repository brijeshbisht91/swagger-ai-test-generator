'use strict';

const fs = require('fs');

const { javaClassNameFromTestFile } = require('./javaNormalize');

const STRICT_GENERATED_TEST_RULES = `
MANDATORY for this test class (violations break the build):
- Use TestNG: import org.testng.annotations.Test; annotate each test method with @Test.
- NEVER use public static void main.
- PetService and UserService are utility classes: ALL API calls are STATIC. The constructor is private — compilation FAILS on "new PetService()" or "new UserService()".
- NEVER declare a local variable holding a service instance (no PetService ps = …; no ps.createPet). ALWAYS call PetService.createPet(...) and UserService.* as static methods on the class name only.
- models.Pet uses Lombok @Data + constructors: NEVER Pet.builder() (there is no @Builder). Use TestDataBuilder.petMyPet(id) or the full (long, String, List<String>, String) constructor.
- Call only static methods that exist on PetService/UserService (match names/signatures in the attached PetService source).
- IMPORTS: After \`package tests;\`, add every import the file needs. Examples: \`import models.TestDataBuilder;\` if you call TestDataBuilder.*; \`import models.Pet;\` for Pet; \`import java.io.File;\` and \`import java.nio.file.Files;\` for file uploads; \`import io.restassured.response.Response;\` for Response. Missing imports cause "cannot find symbol" compile errors.
`.trim();

function loadFrameworkInstructions(frameworkDocPath) {
  try {
    return fs.readFileSync(frameworkDocPath, 'utf8').trim();
  } catch (e) {
    console.warn(
      `⚠️  Could not read ${frameworkDocPath}; using minimal inline framework hint.`
    );
    return [
      'Use TestNG + Rest Assured.',
      'Tests in package tests; call services (PetService, UserService) instead of raw given() without spec.',
      'Use RequestSpecBuilderUtil.getPetstoreRequestSpec() or getRequestSpec(); config from config.properties.',
      'Use ResponseValidator for HTTP status; POJOs + TestDataBuilder for bodies.',
      'Do not extend BaseTest unless legacy; prefer service + explicit RequestSpecification.'
    ].join('\n');
  }
}

function createTestPrompt({
  change,
  existingCode = '',
  outputJavaPath = '',
  operationDetail = null,
  petServiceContext = '',
  frameworkInstructions
}) {
  const renameHint = change.renameFromPath
    ? `Path migration: the API path was corrected from "${change.renameFromPath}" to "${change.endpoint.split('#')[0]}". Update service methods or .post()/.put()/.get() paths to use the new path; keep PetService/UserService encapsulation when possible. Keep the same public class name as the target file.\n\n`
    : '';

  const requiredClass = outputJavaPath
    ? javaClassNameFromTestFile(outputJavaPath)
    : '';
  const classRule = requiredClass
    ? `REQUIRED: The output file is \`${requiredClass}.java\`. The one public class MUST be named exactly \`${requiredClass}\`. Do not rename it to match operationId, summary, or endpoint text (e.g. never use UpdatePetTest for this file).\n\n`
    : '';

  const openApiBlock = operationDetail
    ? `OpenAPI operation (authoritative — use real paths, methods, requestBody, parameters, consumes):\n${JSON.stringify(operationDetail, null, 2)}\n\n`
    : '';

  const serviceBlock = petServiceContext
    ? `Current PetService.java (call ONLY these static method signatures; do not invent builders):\n${petServiceContext}\n\n`
    : '';

  return `
You are a senior QA Automation Engineer.

Follow the repository Java test framework below exactly. Prefer extending services (PetService, UserService) or calling them from tests; do not hardcode base URLs or API keys.

--- FRAMEWORK (mandatory) ---
${frameworkInstructions}
--- END FRAMEWORK ---

--- STRICT TEST RULES ---
${STRICT_GENERATED_TEST_RULES}
--- END STRICT ---

${classRule}${renameHint}${openApiBlock}${serviceBlock}Swagger Change:
Endpoint: ${change.endpoint}
Type: ${change.type}
Category: ${change.category}
${change.operationId ? `operationId: ${change.operationId} (do not use this to name the Java class)\n` : ''}

${existingCode ? `Existing Test:\n${existingCode}` : ''}

Task:
- PetService / UserService: use ONLY static calls on the class name (e.g. PetService.getPet(1L)). Never instantiate services.
- Before finishing, verify imports match every referenced type/helper (TestDataBuilder, Pet, File, Files, Response, etc.).
- If NEW (and no rename hint) → create full test for this method only (package tests; use services + ResponseValidator + models as per FRAMEWORK).
- If UPDATED → modify only affected parts; keep framework layering.
- If DELETED → suggest removal
- If rename hint is present → minimally edit paths or service methods; do not add unrelated operations

Return ONLY Java source code (one file). No markdown fences unless wrapping a single java block is unavoidable—we strip fences downstream.
`;
}

function buildCompileFixPrompt({
  strictRules = STRICT_GENERATED_TEST_RULES,
  petServiceJava = '',
  compileLog,
  brokenSource
}) {
  const petCtx = petServiceJava
    ? `\n--- PetService.java (use these exact static method names/signatures) ---\n${petServiceJava}\n--- end PetService ---\n`
    : '';

  return `You fix a Java TestNG test so it compiles. Output ONLY the complete fixed .java file, no markdown.

${strictRules}

Fix checklist (apply every item that applies):
- Read each javac error below; fix symbol resolution: add missing import lines after package (e.g. TestDataBuilder → import models.TestDataBuilder; File → import java.io.File; Files → import java.nio.file.Files; IOException → import java.io.IOException; Response → import io.restassured.response.Response).
- Prefer models.TestDataBuilder for pet bodies — NEVER Pet.builder(); Pet.photoUrls is java.util.List<String> not String[].
- PetService/UserService: ONLY static methods — NEVER "new PetService()" or petService.createPet(); use PetService.createPet(...) etc.
- Match PetService static methods exactly to the PetService.java block below.
${petCtx}
Compiler output (fix ALL errors):
${compileLog.slice(-12000)}

--- File to fix ---
${brokenSource}`;
}

module.exports = {
  STRICT_GENERATED_TEST_RULES,
  loadFrameworkInstructions,
  createTestPrompt,
  buildCompileFixPrompt
};
