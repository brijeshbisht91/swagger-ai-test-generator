# Java API test framework (for Ollama / code generation)

This file is injected into prompts by `node app.js` so generated tests match the repo layout under `java-tests/`.

## Layers (dependency direction)

1. **Tests** (`package tests;`) — TestNG methods only: call services, assert with TestNG/Hamcrest. **No** raw `given()` without a spec.
2. **Services** (`package services;`) — One class per API product surface, static methods returning `io.restassured.response.Response`:
   - **Petstore v2** → `PetService`: `createPet(Pet)`, `getPet(long)`, `updatePet(Pet)`, `deletePet(long)`.
   - **Reqres** (users, etc.) → `UserService`: `getUsers(int page)`, `create(String name, String job)`.
3. **Core** (`package core;`) — `ConfigReader` reads `java-tests/src/test/resources/config.properties`. `RequestSpecBuilderUtil` exposes:
   - `getRequestSpec()` — Reqres: `base.url`, `api.key`, JSON.
   - `getPetstoreRequestSpec()` — Petstore: `petstore.base.url`, JSON.
4. **Models** (`package models;`) — POJOs for JSON bodies/responses (Lombok `@Data` where used). Use `TestDataBuilder` static factories for test payloads (e.g. `petForGet(id)`, `createUser(name, job)`).
5. **Utils** (`package utils;`) — `ResponseValidator.validateStatusCode(Response, int)`, `validateJsonKey(Response, String)`.

## Config keys (`config.properties`)

- `base.url` — Reqres base (no trailing path).
- `api.key` — Reqres `x-api-key`.
- `petstore.base.url` — e.g. `https://petstore.swagger.io/v2`.

Do **not** hardcode these URLs or API keys in new generated code.

## Rest Assured rules

- **Petstore calls:** `import static io.restassured.RestAssured.given;` then `given().spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())` — preferably **inside** `PetService`, not duplicated in every test.
- **Reqres calls:** same pattern with `getRequestSpec()` inside `UserService`.
- For **new** Petstore endpoints: extend `PetService` (or add a new `*Service` class) with methods that take POJOs or primitives; tests call the service.
- HTTP status: `ResponseValidator.validateStatusCode(response, expectedCode)` after the service returns `Response`.
- Request bodies: use **POJOs** + `TestDataBuilder` (or new builder methods), not long JSON strings, unless the schema is truly dynamic.

## Test class rules

- **Package:** `tests`.
- **TestNG only:** use `@Test` on each test method. **Never** use `public static void main`.
- **Services are static:** `PetService` / `UserService` are `final` with a **private** constructor — call **`PetService.createPet(...)`** etc. **Never** `new PetService()` or `new UserService()`.
- **Models:** `Pet` uses Lombok `@Data` + constructors — **no** `Pet.builder()` unless `@Builder` is explicitly added to the class.
- **Imports:** `services.*`, `utils.ResponseValidator`, `models.*` as needed; avoid unused imports.
- **BaseTest:** Do **not** default to `extends base.BaseTest` for new tests that use `RequestSpecBuilderUtil` + services (that pattern sets only global `baseURI` and fights explicit specs). Use **service + spec** only. Legacy tests may still extend `BaseTest`; prefer the layered style for new code.
- **Class name:** Must match the target filename exactly (e.g. file `PostpetTest.java` → `public class PostpetTest`). Never rename the class from `operationId` if it conflicts with the filename.

## When the generator outputs a single-endpoint test file

The pipeline maps each Swagger change to `java-tests/src/test/java/tests/<DerivedName>Test.java`. For that file:

- Prefer **thin** tests: build payload with `TestDataBuilder` / models, call the appropriate **Service** method, then validate.
- If `PetService` (or another service) already centralizes that verb+path, **call it** from the test instead of inlining `given()...post("/pet")`.
- If no service method exists yet for the new operation, **`node app.js` may run a second Ollama pass** to update `PetService.java` (when `OLLAMA_SYNC_SERVICE` is not `0`), then generate the test. You should still write the test calling the **correct static method name** (e.g. `PetService.uploadPetImage(...)`).

## Petstore `Pet` model (reference)

Fields used today: `long id`, `String name`, `List<String> photoUrls`, `String status`. Add fields only if the OpenAPI schema requires them for the operation under test.
