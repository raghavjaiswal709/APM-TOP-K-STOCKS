#!/bin/bash
source ./manager.sh

# Test get_all_instances
echo "Testing get_all_instances:"
instances=$(get_all_instances)
echo "Result: $instances"
echo ""

# Test select_instance simulation
echo "Simulating select_instance with stopped filter:"
for instance in $instances; do
    echo "  Found instance: $instance"
done
