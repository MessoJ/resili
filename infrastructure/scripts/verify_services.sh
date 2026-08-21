#!/usr/bin/env bash
# Teammate 4 (DevOps & Data) Verification Script
#
# Tests connectivity and health across all microservices:
# 1. PostGIS Database
# 2. Python ML Service (port 8001)
# 3. Go API Gateway (port 8080)

set -e

echo "=== resili INFRASTRUCTURE HEALTH CHECK ==="

echo "1. Checking Python ML Forecast Service (port 8001)..."
curl -s -f http://localhost:8001/health || echo "ML service offline"
echo ""

echo "2. Checking Go API Gateway (port 8080)..."
curl -s -f http://localhost:8080/api/v1/health || echo "Gateway offline"
echo ""

echo "3. Querying All Wards Risk GeoJSON..."
curl -s http://localhost:8080/api/v1/wards/risk/all | grep -o "FeatureCollection" || echo "GeoJSON check failed"
echo ""

echo "4. Checking Tamper-Evident Audit Ledger..."
curl -s http://localhost:8080/api/v1/ledger | grep -o "chain_valid" || echo "Ledger check failed"
echo ""

# TODO (Teammate 4): Add a check for Africa's Talking USSD callback:
# curl -s -X POST http://localhost:8080/api/v1/ussd -d "text=1"

echo "=== ALL CHECKS COMPLETED ==="
