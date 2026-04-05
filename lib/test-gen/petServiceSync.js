'use strict';

const fs = require('fs');

const { mvnTestCompileResult, logMvnFailure } = require('./maven');
const { stripMarkdownCodeFence } = require('./javaNormalize');
const { parseEndpoint } = require('./swaggerChange');
const {
  petServiceLikelyHasPath,
  isPostPetUploadImageOperation
} = require('./openapiHelpers');

const DELETE_PET_MARKER = '.delete("/pet/" + id);\n    }';

function tryApplyDeterministicPetUploadImage(operationDetail, petServicePath) {
  if (!isPostPetUploadImageOperation(operationDetail)) return false;
  if (!fs.existsSync(petServicePath)) return false;
  let src = fs.readFileSync(petServicePath, 'utf8');
  if (/uploadPetImage\s*\(/.test(src)) return true;
  if (!src.includes('import java.io.File')) {
    src = src.replace(
      'import static io.restassured.RestAssured.given;\n',
      'import static io.restassured.RestAssured.given;\n\nimport java.io.File;\n'
    );
  }
  if (!src.includes('import io.restassured.http.ContentType')) {
    src = src.replace(
      'import core.RequestSpecBuilderUtil;\n',
      'import core.RequestSpecBuilderUtil;\nimport io.restassured.http.ContentType;\n'
    );
  }
  const uploadBlock = `
    /** POST /pet/{petId}/uploadImage (multipart). */
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        io.restassured.specification.RequestSpecification req = given()
                .spec(RequestSpecBuilderUtil.getPetstoreRequestSpec())
                .contentType(ContentType.MULTIPART);
        if (additionalMetadata != null && !additionalMetadata.isEmpty()) {
            req = req.multiPart("additionalMetadata", additionalMetadata);
        }
        if (file != null) {
            req = req.multiPart("file", file);
        }
        return req.when().post("/pet/" + petId + "/uploadImage");
    }`;
  if (!src.includes(DELETE_PET_MARKER)) {
    console.warn(
      '⚠️  PetService: cannot find deletePet anchor for deterministic uploadPetImage'
    );
    return false;
  }
  src = src.replace(DELETE_PET_MARKER, DELETE_PET_MARKER + uploadBlock);
  fs.writeFileSync(petServicePath, src);
  return true;
}

function ensureCanonicalUploadPetImageMethod(operationDetail, petServicePath, javaTestsCwd) {
  if (!isPostPetUploadImageOperation(operationDetail)) return;
  if (!fs.existsSync(petServicePath)) return;
  let src = fs.readFileSync(petServicePath, 'utf8');
  if (/uploadPetImage\s*\(/.test(src)) return;
  if (!src.includes(DELETE_PET_MARKER)) return;

  const backup = src;
  let alias = '';

  if (
    /public\s+static\s+Response\s+uploadImage\s*\(\s*long\s+petId\s*,\s*File\s+file\s*,\s*String\s+additionalMetadata\s*\)/.test(
      src
    )
  ) {
    alias = `
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        return uploadImage(petId, file, additionalMetadata);
    }`;
  } else if (
    /public\s+static\s+Response\s+uploadImage\s*\(\s*long\s+petId\s*,\s*String\s+\w+\s*,\s*File\s+\w+\s*\)/.test(
      src
    )
  ) {
    alias = `
    public static Response uploadPetImage(long petId, String additionalMetadata, File file) {
        return uploadImage(petId, additionalMetadata, file);
    }`;
  }

  if (!alias) return;

  src = src.replace(DELETE_PET_MARKER, DELETE_PET_MARKER + alias);
  fs.writeFileSync(petServicePath, src);
  const c = mvnTestCompileResult(javaTestsCwd);
  if (!c.ok) {
    logMvnFailure('uploadPetImage alias failed compile; reverting PetService.', c.log);
    fs.writeFileSync(petServicePath, backup);
  } else {
    console.log('👉 Added PetService.uploadPetImage alias (canonical name for tests).');
  }
}

function ensurePetServiceHasUploadPetImage(
  operationDetail,
  petServicePath,
  javaTestsCwd
) {
  ensureCanonicalUploadPetImageMethod(
    operationDetail,
    petServicePath,
    javaTestsCwd
  );
  if (!isPostPetUploadImageOperation(operationDetail) || !fs.existsSync(petServicePath)) {
    return;
  }
  const src = fs.readFileSync(petServicePath, 'utf8');
  if (/uploadPetImage\s*\(/.test(src)) return;
  const backup = fs.readFileSync(petServicePath, 'utf8');
  if (tryApplyDeterministicPetUploadImage(operationDetail, petServicePath)) {
    const c = mvnTestCompileResult(javaTestsCwd);
    if (!c.ok) {
      logMvnFailure('Deterministic uploadPetImage insert failed compile.', c.log);
      fs.writeFileSync(petServicePath, backup);
    } else {
      console.log('👉 Inserted deterministic PetService.uploadPetImage.');
    }
  }
}

async function syncPetServiceWithOllama({
  change,
  operationDetail,
  petServicePath,
  javaTestsCwd,
  callOllama
}) {
  if (String(process.env.OLLAMA_SYNC_SERVICE || '1') === '0') return;
  if (!operationDetail || !change.endpoint.includes('/pet')) return;
  if (!fs.existsSync(petServicePath)) {
    console.warn('⚠️  PetService.java missing; skip service sync');
    return;
  }
  const { path: apiPath } = parseEndpoint(change.endpoint);
  let src = fs.readFileSync(petServicePath, 'utf8');
  if (petServiceLikelyHasPath(src, apiPath)) {
    console.log(
      '👉 PetService already covers path literals; skipping Ollama service sync'
    );
    return;
  }
  console.log('👉 Ollama: updating PetService.java for this operation...');
  const prompt = `You are editing Java. Output ONLY the complete PetService.java file, no markdown.

Preserve every existing public static method unless you must fix a path string for the same operation.

Add or adjust ONE public static method returning io.restassured.response.Response for this OpenAPI operation (path template + method):
${JSON.stringify(operationDetail, null, 2)}

Rules:
- package services; public final class PetService; private PetService() {}
- Use given().spec(RequestSpecBuilderUtil.getPetstoreRequestSpec()) like existing methods.
- For multipart/form-data use ContentType.MULTIPART and multiPart(...) for each form field from the spec.
- Build URLs with string concat for path params (e.g. "/pet/" + petId + "/uploadImage").
- Required imports when using File / MULTIPART: import java.io.File; import io.restassured.http.ContentType;
Full current file:
${src}`;

  const backup = src;
  const raw = await callOllama(prompt);
  let next = stripMarkdownCodeFence(raw);
  if (!next.includes('package services')) {
    console.warn('⚠️  PetService sync output invalid; keeping previous file.');
    tryApplyDeterministicPetUploadImage(operationDetail, petServicePath);
    const c0 = mvnTestCompileResult(javaTestsCwd);
    if (!c0.ok) {
      logMvnFailure('Deterministic PetService patch after invalid LLM output failed.', c0.log);
      fs.writeFileSync(petServicePath, backup);
    }
    return;
  }
  fs.writeFileSync(petServicePath, next);
  let compile = mvnTestCompileResult(javaTestsCwd);
  if (compile.ok) {
    console.log('✅ PetService.java updated and compiles.');
    return;
  }
  logMvnFailure('mvn test-compile failed after PetService sync; reverting.', compile.log);
  fs.writeFileSync(petServicePath, backup);
  if (tryApplyDeterministicPetUploadImage(operationDetail, petServicePath)) {
    const c2 = mvnTestCompileResult(javaTestsCwd);
    if (c2.ok) {
      console.log('✅ Deterministic uploadPetImage applied; compiles.');
    } else {
      logMvnFailure('Deterministic PetService patch did not compile.', c2.log);
      fs.writeFileSync(petServicePath, backup);
    }
  }
}

module.exports = {
  syncPetServiceWithOllama,
  ensurePetServiceHasUploadPetImage
};
