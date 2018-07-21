# 0.2.0(08.01.2017)
## Breaking Changes
The service name is added to the statemachine prefix.
This is because there is a possibility of conflict with the state machine deployed from another service without the service name.

A state machine created with version 0.1 is not inherited. Please recreate it.

## Features
- Display error log when invocation of the step function fail(#6)
- Read json file when the statemachine invoke(#7)

## Bugs
- AWS Region not read from provider.region(#3)
- Serverless service prefix not included in state machine name(#4)
- Parallel tasks do not have their arn identifiers resolved(#5)

# 0.1.2(29.12.2016)
Accidentally release(#1)

# 0.1.1(29.12.2016)
First Release
