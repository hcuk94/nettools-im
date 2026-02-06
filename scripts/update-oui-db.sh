#!/bin/bash
# Download and update IEEE OUI databases for MAC vendor lookup
# This script updates the local database files
# Run manually when you want to refresh the OUI data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../assets/data"
TEMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== Updating OUI database ==="
echo "This script requires Python3 to be installed locally."
echo "The Jenkins build does NOT run this - it uses pre-built database files."
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 is required to update the database."
    echo "Please install Python 3 and run this script locally."
    exit 1
fi

# Create output directory
mkdir -p "$DATA_DIR"

echo "Downloading IEEE OUI databases..."

# Download all databases
curl -fsSL "https://standards-oui.ieee.org/oui/oui.csv" -o "$TEMP_DIR/oui.csv" || echo "WARNING: Failed to download MA-L"
curl -fsSL "https://standards-oui.ieee.org/oui28/mam.csv" -o "$TEMP_DIR/mam.csv" || echo "WARNING: Failed to download MA-M"
curl -fsSL "https://standards-oui.ieee.org/oui36/oui36.csv" -o "$TEMP_DIR/oui36.csv" || echo "WARNING: Failed to download MA-S"
curl -fsSL "https://standards-oui.ieee.org/cid/cid.csv" -o "$TEMP_DIR/cid.csv" || echo "WARNING: Failed to download CID"
curl -fsSL "https://standards-oui.ieee.org/iab/iab.csv" -o "$TEMP_DIR/iab.csv" || echo "WARNING: Failed to download IAB"

echo "Processing with Python..."

python3 << 'PYTHON_SCRIPT'
import csv
import json
import os
from datetime import datetime, timezone

temp_dir = os.environ.get('TEMP_DIR')
data_dir = os.environ.get('DATA_DIR')

def normalize_prefix(prefix):
    return prefix.upper().replace('-', '').replace(':', '').replace('.', '')

def parse_ieee_csv(filepath):
    entries = {}
    if not os.path.exists(filepath):
        return entries
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                assignment = row.get('Assignment', '').strip()
                org_name = row.get('Organization Name', '').strip()
                org_address = row.get('Organization Address', '').strip()
                
                if not assignment or not org_name:
                    continue
                
                prefix = normalize_prefix(assignment)
                address_parts = [p.strip() for p in org_address.split('\n') if p.strip()]
                
                entries[prefix] = {
                    'n': org_name,
                    'a': org_address if org_address else None,
                    'c': address_parts[-1] if address_parts else None
                }
    except Exception as e:
        print(f"Error parsing {filepath}: {e}")
    
    return entries

# Process databases
mal = parse_ieee_csv(f"{temp_dir}/oui.csv")
mam = parse_ieee_csv(f"{temp_dir}/mam.csv")
mas = parse_ieee_csv(f"{temp_dir}/oui36.csv")
cid = parse_ieee_csv(f"{temp_dir}/cid.csv")
iab = parse_ieee_csv(f"{temp_dir}/iab.csv")

print(f"MA-L: {len(mal)} entries")
print(f"MA-M: {len(mam)} entries")
print(f"MA-S: {len(mas)} entries")
print(f"CID: {len(cid)} entries")
print(f"IAB: {len(iab)} entries")

database = {
    'version': 1,
    'generated': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    'counts': {
        'mal': len(mal),
        'mam': len(mam),
        'mas': len(mas),
        'cid': len(cid),
        'iab': len(iab),
        'total': len(mal) + len(mam) + len(mas) + len(cid) + len(iab)
    },
    'mal': mal,
    'mam': mam,
    'mas': {**mas, **iab},
    'cid': cid
}

# Write full database
with open(f"{data_dir}/oui-database.json", 'w', encoding='utf-8') as f:
    json.dump(database, f, separators=(',', ':'))

# Write lite database
lite_db = {
    'version': 1,
    'generated': database['generated'],
    'counts': database['counts'],
    'mal': {k: v['n'] for k, v in mal.items()},
    'mam': {k: v['n'] for k, v in mam.items()},
    'mas': {k: v['n'] for k, v in {**mas, **iab}.items()},
}

with open(f"{data_dir}/oui-database-lite.json", 'w', encoding='utf-8') as f:
    json.dump(lite_db, f, separators=(',', ':'))

print(f"\nDatabase files updated in {data_dir}")
PYTHON_SCRIPT

echo ""
echo "=== Database update complete ==="
ls -lh "$DATA_DIR"/*.json
