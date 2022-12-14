# cn-shell

## 3.3.0

### Minor Changes

- Changed config methods to take the config string

### Patch Changes

- Removed leading space on log entries that have no timestamp

  Added status code to exit() method

  Changed appVersion in Shell constructor to default to "N/A"

## 3.2.1

### Patch Changes

- Removed the "required" property for config options because it was confusing when supplying a default value
- Added shelljs methods to cn-shell and removed the "sh" getter to make using the shelljs methods easier

## 3.2.0

### Minor Changes

- Renamed classes and files to make things more consistent

## 3.1.1

### Patch Changes

- Fixed issue with httpReq when the body was empty

## 3.1.0

### Minor Changes

- Added httpReq method

### Patch Changes

- You can now specify all CNA configs in the CNShellConfig object
- Replaced luxon with dayjs for date formatting due to ES module issue

## 3.0.2

### Patch Changes

- Minor behind the scene changes to CNConfigMan

## 3.0.1

### Patch Changes

- Removing the CN Version for now

## 3.0.0

### Major Changes

- Latest and greatest release of cn-shell - V3 baby!
