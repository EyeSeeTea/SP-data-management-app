## Setup

```
$ yarn install
```

## Development

Start development server:

```
$ export PORT=8081
$ export REACT_APP_DHIS2_BASE_URL="https://play.dhis2.org/2.32"
$ yarn start
```

## Tests

Setup (only when config object changes):

```
$ yarn generate-test-fixtures 'http://admin:PASSWORD@SERVER'
```

Unit testing:

```
$ yarn test
```

Run integration tests locally:

```
$ export CYPRESS_DHIS2_AUTH='admin:district'
$ export CYPRESS_EXTERNAL_API="http://localhost:8080"
$ export CYPRESS_ROOT_URL=http://localhost:8081

$ yarn cy:e2e:open # interactive UI
$ [xvfb-run] yarn cy:e2e:run # non-interactive UI
```

For cypress tests to work in Travis CI, you will have to create an environment variable CYPRESS_DHIS2_AUTH (Settings -> Environment Variables) with the authentication used in your testing DHIS2 instance.

## Build

```
$ yarn build-webapp
```

## Internals

### Database relationships

A project consist of these Dhis2 metadata:

-   1 organisation unit (level 2). attributes: `PM_PROJECT_DASHBOARD_ID`
-   2 data sets: actual and target. attributes: `PM_ORGUNIT_PROJECT_ID`
-   1 dashboard.
