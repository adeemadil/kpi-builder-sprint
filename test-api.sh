#!/bin/bash

API="http://localhost:3001/api"

echo "🧪 Testing KPI Builder API"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
  local name=$1
  local cmd=$2
  
  echo -n "Testing $name... "
  
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAILED++))
  fi
}

# Run tests
test_endpoint "Health Check" "curl -sf $API/health | jq -e '.status == \"healthy\"'"

test_endpoint "Get Detections" "curl -sf -X POST $API/detections -H 'Content-Type: application/json' -d '{\"limit\":5}' | jq -e '.data | length > 0'"

test_endpoint "Aggregate by Hour" "curl -sf -X POST $API/aggregate -H 'Content-Type: application/json' -d '{\"metric\":\"count\",\"groupBy\":\"hour\"}' | jq -e '.series | length > 0'"

test_endpoint "Aggregate by Class" "curl -sf -X POST $API/aggregate -H 'Content-Type: application/json' -d '{\"metric\":\"count\",\"groupBy\":\"class\"}' | jq -e '.series | length > 0'"

test_endpoint "Close Calls" "curl -sf -X POST $API/close-calls -H 'Content-Type: application/json' -d '{\"filters\":{\"timeRange\":{\"from\":\"2025-01-01\",\"to\":\"2025-01-07\"}},\"distance\":2.0}' | jq -e '.series'"

test_endpoint "Vest Violations" "curl -sf '$API/vest-violations?from=2025-01-01&to=2025-01-07' | jq -e '.series'"

test_endpoint "Overspeed Events" "curl -sf '$API/overspeed?from=2025-01-01&to=2025-01-07&threshold=1.5' | jq -e '.series'"

echo ""
echo "=========================="
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed! 🎉${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed ❌${NC}"
  exit 1
fi


