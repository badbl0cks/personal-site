#!/bin/bash

cd $(dirname $(dirname $(realpath $0)))

# Path to the original .env file
ENV_FILE=".env"
# Path to the new .env.example file
EXAMPLE_FILE=".env.example"

# Check if the .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "The file $ENV_FILE does not exist."
    exit 1
fi

# Create or empty the .env.example file
> "$EXAMPLE_FILE"

SKIP_NEXT=false

# Read each line in .env
while IFS= read -r line; do
  # Skip the current line if the previous line is part of a multiline/quoted string
  if [[ $SKIP_NEXT == true ]]; then
    if [[ $line == *'"'* ]]; then
        SKIP_NEXT=false
    fi
    continue
  # Copy comments and empty lines verbatim
  elif [[ $line == \#* ]] || [[ -z $line ]]; then
    echo "$line" >> "$EXAMPLE_FILE"
    continue
  # Check if the line is a multiline/quoted string
  elif [[ $line == *'="'* ]]; then
    if [[ $line != *'"' ]]; then
      SKIP_NEXT=true
    fi
    LINE=${line%%=*}
    echo "$LINE=\"\${$LINE}\"" >> "$EXAMPLE_FILE"
  # For all other lines, copy only the key (everything before the '=') if present
  elif [[ $line == *'='* ]]; then
    LINE=${line%%=*}
    echo "$LINE=\${$LINE}" >> "$EXAMPLE_FILE"
  fi
done < "$ENV_FILE"

echo ".env.example file created successfully."
