# VSCode Elm Format

This extensions allows you to run `elm-format` on visual studio code.

This is just a simple extensions that execute `elm-format` if it exists on your global PATH.
You will have to install `elm-format` and set the executable in your global PATH first before you can use this extension.

For more information on how to install `elm-path` please refer to their [installation guide](https://github.com/avh4/elm-format#installation)

## Installation
Install this extension using VSCode command pallete:
```
ext install elm-format
```

## How to Use
You can run `elm-format` by using this command:
```
Elm: Format
```
or you can also run elm-format whenever you save the file by enabling the `formatOnSave' option.

## Configuration
- **elm-format.formatOnSave**
  - type: "boolean"
  - default: false
  - description: "Run elm-format on save.
