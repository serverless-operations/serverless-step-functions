# Changelog

## [3.26.0](https://github.com/serverless-operations/serverless-step-functions/compare/v3.25.0...v3.26.0) (2026-03-18)


### Features

* **iam:** generate IAM policy for http:invoke (Call third-party API) states ([#688](https://github.com/serverless-operations/serverless-step-functions/issues/688)) ([11018ae](https://github.com/serverless-operations/serverless-step-functions/commit/11018ae50a9d31bc7f5a2ad67772af1d709ceec5)), closes [#599](https://github.com/serverless-operations/serverless-step-functions/issues/599)


### Bug Fixes

* **iam:** generate IAM policy for aws-sdk:dynamodb:scan resource ([#684](https://github.com/serverless-operations/serverless-step-functions/issues/684)) ([a47454a](https://github.com/serverless-operations/serverless-step-functions/commit/a47454a7b7125e11c3515aafe2df9b84e23dafaa)), closes [#584](https://github.com/serverless-operations/serverless-step-functions/issues/584)
* **iam:** generate IAM policy for aws-sdk:sesv2:sendEmail resource ([#689](https://github.com/serverless-operations/serverless-step-functions/issues/689)) ([eeaa755](https://github.com/serverless-operations/serverless-step-functions/commit/eeaa755581eb198d423736ec34f080919eb4796e)), closes [#610](https://github.com/serverless-operations/serverless-step-functions/issues/610)
* **notifications:** resolve local function names to CloudFormation logical IDs ([#690](https://github.com/serverless-operations/serverless-step-functions/issues/690)) ([ad5e98a](https://github.com/serverless-operations/serverless-step-functions/commit/ad5e98ab394517f16abd9672aa528cdb5e48f390)), closes [#582](https://github.com/serverless-operations/serverless-step-functions/issues/582)

## [3.25.0](https://github.com/serverless-operations/serverless-step-functions/compare/v3.24.4...v3.25.0) (2026-03-18)


### Features

* **api-gateway:** support timeoutInMillis for http events ([#673](https://github.com/serverless-operations/serverless-step-functions/issues/673)) ([e0057e3](https://github.com/serverless-operations/serverless-step-functions/commit/e0057e3798f7b708044e21b235e75842107ad43f)), closes [#651](https://github.com/serverless-operations/serverless-step-functions/issues/651)


### Bug Fixes

* **iam:** apply provider.iam.role.path to state machine execution roles ([#674](https://github.com/serverless-operations/serverless-step-functions/issues/674)) ([aa4755a](https://github.com/serverless-operations/serverless-step-functions/commit/aa4755a9e5067aa8288945df6595f7b862c524f9)), closes [#653](https://github.com/serverless-operations/serverless-step-functions/issues/653)

## [3.24.4](https://github.com/serverless-operations/serverless-step-functions/compare/v3.24.3...v3.24.4) (2026-03-18)


### Bug Fixes

* pkg url ([f29f072](https://github.com/serverless-operations/serverless-step-functions/commit/f29f07247d6400dd2029e006e25d8b37505dbbfb))

## [3.24.3](https://github.com/serverless-operations/serverless-step-functions/compare/v3.24.2...v3.24.3) (2026-03-18)


### Bug Fixes

* pkg json ([cfb37e4](https://github.com/serverless-operations/serverless-step-functions/commit/cfb37e48d4671cc24161932d58bc4947e4a41432))

## [3.24.2](https://github.com/serverless-operations/serverless-step-functions/compare/v3.24.1...v3.24.2) (2026-03-18)


### Bug Fixes

* upgrade node v24 ([08b333c](https://github.com/serverless-operations/serverless-step-functions/commit/08b333cad69131936b7ec3af02ccb8e3dff45384))

## [3.24.1](https://github.com/serverless-operations/serverless-step-functions/compare/v3.24.0...v3.24.1) (2026-03-18)


### Bug Fixes

* add release please ([d08a43d](https://github.com/serverless-operations/serverless-step-functions/commit/d08a43deed6615d751a83ace4c52f7ab2a9b2180))
