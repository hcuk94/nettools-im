#!/bin/bash
# Download and process IEEE OUI databases for MAC vendor lookup
# Sources: IEEE Standards Association (official)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/../assets/data"
TEMP_DIR=$(mktemp -d)

# Export variables so Python can access them
export TEMP_DIR
export DATA_DIR

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== Downloading IEEE OUI databases ==="
echo "Using temp directory: $TEMP_DIR"
echo "Output directory: $DATA_DIR"

# Create output directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Download MA-L (24-bit OUI - most common)
echo "Downloading MA-L (OUI) database..."
curl -sL "https://standards-oui.ieee.org/oui/oui.csv" -o "$TEMP_DIR/oui.csv"
ls -lh "$TEMP_DIR/oui.csv"

# Download MA-M (28-bit)
echo "Downloading MA-M database..."
curl -sL "https://standards-oui.ieee.org/oui28/mam.csv" -o "$TEMP_DIR/mam.csv"
ls -lh "$TEMP_DIR/mam.csv"

# Download MA-S (36-bit)
echo "Downloading MA-S database..."
curl -sL "https://standards-oui.ieee.org/oui36/oui36.csv" -o "$TEMP_DIR/oui36.csv"
ls -lh "$TEMP_DIR/oui36.csv"

# Download CID (Company ID)
echo "Downloading CID database..."
curl -sL "https://standards-oui.ieee.org/cid/cid.csv" -o "$TEMP_DIR/cid.csv"
ls -lh "$TEMP_DIR/cid.csv"

# Download IAB (Individual Address Block - legacy)
echo "Downloading IAB database..."
curl -sL "https://standards-oui.ieee.org/iab/iab.csv" -o "$TEMP_DIR/iab.csv"
ls -lh "$TEMP_DIR/iab.csv"

echo ""
echo "=== Processing databases ==="

# Create a Python script to process the CSVs into optimized JSON
python3 << 'PYTHON_SCRIPT'
import csv
import json
import os
from datetime import datetime, timezone

temp_dir = os.environ.get('TEMP_DIR', '/tmp')
data_dir = os.environ.get('DATA_DIR', './assets/data')

print(f"Python using temp_dir: {temp_dir}")
print(f"Python using data_dir: {data_dir}")

os.makedirs(data_dir, exist_ok=True)

def normalize_prefix(prefix):
    """Normalize MAC prefix to uppercase hex without separators"""
    return prefix.upper().replace('-', '').replace(':', '').replace('.', '')

def parse_ieee_csv(filepath, prefix_length):
    """Parse IEEE CSV format and return dict of prefix -> vendor info"""
    entries = {}
    
    if not os.path.exists(filepath):
        print(f"  WARNING: File not found: {filepath}")
        return entries
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # IEEE CSV has: Registry, Assignment, Organization Name, Organization Address
                assignment = row.get('Assignment', '').strip()
                org_name = row.get('Organization Name', '').strip()
                org_address = row.get('Organization Address', '').strip()
                
                if not assignment or not org_name:
                    continue
                
                prefix = normalize_prefix(assignment)
                
                # Parse address into components if possible
                address_parts = [p.strip() for p in org_address.split('\n') if p.strip()]
                
                entries[prefix] = {
                    'n': org_name,  # name (shortened key for file size)
                    'a': org_address if org_address else None,  # address
                    'c': address_parts[-1] if address_parts else None  # country (usually last line)
                }
    except Exception as e:
        print(f"  ERROR parsing {filepath}: {e}")
    
    return entries

# Process each database
print("Processing MA-L (24-bit OUI)...")
mal = parse_ieee_csv(f"{temp_dir}/oui.csv", 6)
print(f"  Found {len(mal)} entries")

print("Processing MA-M (28-bit)...")
mam = parse_ieee_csv(f"{temp_dir}/mam.csv", 7)
print(f"  Found {len(mam)} entries")

print("Processing MA-S (36-bit)...")
mas = parse_ieee_csv(f"{temp_dir}/oui36.csv", 9)
print(f"  Found {len(mas)} entries")

print("Processing CID...")
cid = parse_ieee_csv(f"{temp_dir}/cid.csv", 6)
print(f"  Found {len(cid)} entries")

print("Processing IAB (legacy)...")
iab = parse_ieee_csv(f"{temp_dir}/iab.csv", 9)
print(f"  Found {len(iab)} entries")

# Create combined database structure
# For efficient lookup, we organize by prefix length
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
    # 24-bit prefixes (6 hex chars) - MA-L
    'mal': mal,
    # 28-bit prefixes (7 hex chars) - MA-M
    'mam': mam,
    # 36-bit prefixes (9 hex chars) - MA-S and IAB combined
    'mas': {**mas, **iab},
    # Company IDs (not for MAC lookup but useful reference)
    'cid': cid
}

# Write full database (for detailed lookups)
output_path = f"{data_dir}/oui-database.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(database, f, separators=(',', ':'))

print(f"\nGenerated {output_path}")
print(f"Total entries: {database['counts']['total']}")

# Calculate file size
file_size = os.path.getsize(output_path)
print(f"File size: {file_size / 1024 / 1024:.2f} MB")

# Also create a lightweight version with just names (for faster initial load)
lite_db = {
    'version': 1,
    'generated': database['generated'],
    'counts': database['counts'],
    'mal': {k: v['n'] for k, v in mal.items()},
    'mam': {k: v['n'] for k, v in mam.items()},
    'mas': {k: v['n'] for k, v in {**mas, **iab}.items()},
}

lite_path = f"{data_dir}/oui-database-lite.json"
with open(lite_path, 'w', encoding='utf-8') as f:
    json.dump(lite_db, f, separators=(',', ':'))

lite_size = os.path.getsize(lite_path)
print(f"\nGenerated {lite_path}")
print(f"Lite file size: {lite_size / 1024 / 1024:.2f} MB")

PYTHON_SCRIPT

echo ""
echo "=== OUI database update complete ==="
ls -lh "$DATA_DIR"/*.json 2>/dev/null || echo "No JSON files generated"
