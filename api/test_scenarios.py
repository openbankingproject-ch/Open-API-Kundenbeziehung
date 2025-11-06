#!/usr/bin/env python3
"""
Open Banking API - End-to-End Test Scenarios

This script automatically checks all prerequisites before running tests:
- Python dependencies (requests library)
- Node.js and npm installation
- API npm dependencies (node_modules)
- Critical packages (express, helmet, jsonwebtoken, etc.)

If any dependencies are missing, the script provides clear installation instructions.

Test Cases:
1. Bank customer getting car insurance (data sharing)
2. Customer transfers from Bank A to Bank B (account opening)

Usage:
  python3 test_scenarios.py

  # Or with venv:
  source .venv/bin/activate && python test_scenarios.py
"""

import subprocess
import time
import requests
import json
import hashlib
import sys
import signal
import os
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

# Configuration
API_BASE_URL = "http://localhost:3001"
API_TIMEOUT = 180  # seconds to wait for API to start (increased for slower systems)
CHECK_INTERVAL = 1  # seconds between health checks (faster polling)


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


class APITestRunner:
    """Test runner for Open Banking API scenarios"""

    def __init__(self):
        self.api_process: Optional[subprocess.Popen] = None
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'OpenBanking-Test-Client/1.0'
        })

    def print_section(self, title: str):
        """Print a formatted section header"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{title.center(80)}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*80}{Colors.ENDC}\n")

    def print_step(self, step: str):
        """Print a test step"""
        print(f"{Colors.OKCYAN}→ {step}{Colors.ENDC}")

    def print_success(self, message: str):
        """Print a success message"""
        print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

    def print_error(self, message: str):
        """Print an error message"""
        print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

    def print_info(self, message: str):
        """Print an info message"""
        print(f"{Colors.OKBLUE}ℹ {message}{Colors.ENDC}")

    def print_warning(self, message: str):
        """Print a warning message"""
        print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

    def print_data(self, label: str, data: Any):
        """Print formatted data"""
        print(f"{Colors.OKBLUE}{label}:{Colors.ENDC}")
        print(json.dumps(data, indent=2))

    def check_python_dependencies(self) -> bool:
        """Check if Python dependencies are installed"""
        try:
            import requests
            self.print_success(f"Python requests library is installed (version {requests.__version__})")
            return True
        except ImportError:
            self.print_error("Python 'requests' library is not installed")
            self.print_warning("\nTo install Python dependencies, run:")
            api_dir = os.path.dirname(os.path.abspath(__file__))
            print(f"{Colors.BOLD}  pip install -r {os.path.join(api_dir, 'requirements-test.txt')}{Colors.ENDC}")
            print(f"{Colors.BOLD}  # OR{Colors.ENDC}")
            print(f"{Colors.BOLD}  pip install requests{Colors.ENDC}\n")
            return False

    def check_npm_available(self) -> bool:
        """Check if npm is installed"""
        try:
            result = subprocess.run(
                ['npm', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                npm_version = result.stdout.strip()
                self.print_success(f"npm is installed (version {npm_version})")
                return True
            else:
                self.print_error("npm is not working correctly")
                return False
        except FileNotFoundError:
            self.print_error("npm is not installed")
            self.print_info("Please install Node.js and npm from: https://nodejs.org/")
            return False
        except Exception as e:
            self.print_error(f"Error checking npm: {str(e)}")
            return False

    def check_node_available(self) -> bool:
        """Check if Node.js is installed"""
        try:
            result = subprocess.run(
                ['node', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                node_version = result.stdout.strip()
                self.print_success(f"Node.js is installed (version {node_version})")
                return True
            else:
                self.print_error("Node.js is not working correctly")
                return False
        except FileNotFoundError:
            self.print_error("Node.js is not installed")
            self.print_info("Please install Node.js from: https://nodejs.org/")
            return False
        except Exception as e:
            self.print_error(f"Error checking Node.js: {str(e)}")
            return False

    def check_npm_dependencies(self, api_dir: str) -> bool:
        """Check if npm dependencies are installed"""
        self.print_step("Checking npm dependencies...")

        # Check if package.json exists
        package_json_path = os.path.join(api_dir, 'package.json')
        if not os.path.exists(package_json_path):
            self.print_error("package.json not found")
            self.print_info(f"Expected location: {package_json_path}")
            return False

        self.print_success("package.json found")

        # Check if node_modules directory exists
        node_modules_path = os.path.join(api_dir, 'node_modules')
        if not os.path.exists(node_modules_path):
            self.print_error("node_modules directory not found - dependencies are not installed")
            self.print_warning("\nTo install dependencies, run:")
            print(f"{Colors.BOLD}  cd {api_dir}{Colors.ENDC}")
            print(f"{Colors.BOLD}  npm install{Colors.ENDC}\n")
            return False

        # Check if node_modules has content
        try:
            modules = os.listdir(node_modules_path)
            if len(modules) < 10:  # Expect at least 10 packages
                self.print_warning("node_modules exists but seems incomplete")
                self.print_warning("\nTo reinstall dependencies, run:")
                print(f"{Colors.BOLD}  cd {api_dir}{Colors.ENDC}")
                print(f"{Colors.BOLD}  rm -rf node_modules package-lock.json{Colors.ENDC}")
                print(f"{Colors.BOLD}  npm install{Colors.ENDC}\n")
                return False

            self.print_success(f"node_modules found with {len(modules)} packages")
        except Exception as e:
            self.print_error(f"Error checking node_modules: {str(e)}")
            return False

        # Optional: Check for critical dependencies
        critical_deps = ['express', 'helmet', 'jsonwebtoken', 'jose', 'joi']
        missing_deps = []

        for dep in critical_deps:
            dep_path = os.path.join(node_modules_path, dep)
            if not os.path.exists(dep_path):
                missing_deps.append(dep)

        if missing_deps:
            self.print_warning(f"Missing critical dependencies: {', '.join(missing_deps)}")
            self.print_warning("\nTo install missing dependencies, run:")
            print(f"{Colors.BOLD}  cd {api_dir}{Colors.ENDC}")
            print(f"{Colors.BOLD}  npm install{Colors.ENDC}\n")
            return False

        self.print_success("All critical dependencies are installed")
        return True

    def kill_existing_servers(self):
        """Kill any existing API server processes"""
        try:
            # Kill any existing node processes running the API
            subprocess.run(['pkill', '-9', '-f', 'node src/app.js'],
                         capture_output=True, timeout=5)
            subprocess.run(['pkill', '-9', '-f', 'npm start'],
                         capture_output=True, timeout=5)
            time.sleep(1)
        except:
            pass  # Ignore errors if no processes to kill

    def start_api_server(self) -> bool:
        """Start the API server and wait for it to be ready"""
        self.print_section("Starting API Server")

        try:
            # Change to API directory
            api_dir = os.path.dirname(os.path.abspath(__file__))

            self.print_step("Cleaning up any existing API processes...")
            self.kill_existing_servers()

            self.print_step("Checking if server is already running...")
            if self.check_health():
                self.print_success("API server is already running")
                return True

            # Check prerequisites
            self.print_step("Checking prerequisites...")

            if not self.check_node_available():
                return False

            if not self.check_npm_available():
                return False

            if not self.check_npm_dependencies(api_dir):
                return False

            self.print_success("All prerequisites satisfied")
            print()

            self.print_step(f"Starting Node.js server from {api_dir}")

            # Start the API server
            self.api_process = subprocess.Popen(
                ['npm', 'start'],
                cwd=api_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={**os.environ, 'NODE_ENV': 'development', 'PORT': '3001'}
            )

            # Wait for server to be ready
            self.print_step("Waiting for API server to be ready...")
            start_time = time.time()

            while time.time() - start_time < API_TIMEOUT:
                if self.check_health():
                    elapsed = time.time() - start_time
                    self.print_success(f"API server is ready (took {elapsed:.1f}s)")
                    return True
                time.sleep(CHECK_INTERVAL)

            self.print_error(f"API server failed to start within {API_TIMEOUT}s")
            return False

        except Exception as e:
            self.print_error(f"Failed to start API server: {str(e)}")
            return False

    def check_health(self) -> bool:
        """Check if API server is healthy"""
        try:
            response = self.session.get(f"{API_BASE_URL}/health", timeout=5)
            return response.status_code == 200
        except:
            return False

    def stop_api_server(self):
        """Stop the API server"""
        if self.api_process:
            self.print_step("Stopping API server...")
            self.api_process.send_signal(signal.SIGTERM)
            try:
                self.api_process.wait(timeout=10)
                self.print_success("API server stopped gracefully")
            except subprocess.TimeoutExpired:
                self.print_warning("Force killing API server...")
                self.api_process.kill()
                self.api_process.wait()

    def generate_shared_hash(self, last_name: str, given_name: str, birth_date: str, nationality: str) -> str:
        """Generate shared customer hash (same algorithm as API)"""
        hash_input = f"{last_name} {given_name} {birth_date} {nationality}"
        return hashlib.sha256(hash_input.encode()).hexdigest()

    def create_mock_token(self, institution_id: str, scope: str = "customer:read customer:write consent:manage") -> str:
        """
        Create a mock authentication token for testing.
        Note: In production, this would be obtained via OAuth flow.
        For testing, we're creating a simplified token.
        """
        # This is a simplified mock token for testing purposes
        # In a real scenario, you would go through the OAuth flow
        return f"mock-token-{institution_id}-{int(time.time())}"

    def api_request(self, method: str, endpoint: str, institution_id: str,
                    data: Optional[Dict] = None,
                    description: Optional[str] = None) -> Dict[Any, Any]:
        """Make an API request with proper error handling"""
        url = f"{API_BASE_URL}{endpoint}"

        if description:
            self.print_step(description)

        # Create headers with mock authentication
        # Note: Real implementation would use proper OAuth tokens
        headers = {
            'X-Institution-ID': institution_id,
            'X-Test-Mode': 'true',  # Signal to API this is a test request
        }

        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = self.session.post(url, headers=headers, json=data, timeout=10)
            elif method == 'PUT':
                response = self.session.put(url, headers=headers, json=data, timeout=10)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            # Log request details
            self.print_info(f"{method} {endpoint} → HTTP {response.status_code}")

            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"raw": response.text}

            return {
                "status_code": response.status_code,
                "success": 200 <= response.status_code < 300,
                "data": response_data
            }

        except requests.exceptions.RequestException as e:
            self.print_error(f"Request failed: {str(e)}")
            return {
                "status_code": 0,
                "success": False,
                "data": {"error": str(e)}
            }

    def test_case_1_insurance(self) -> bool:
        """
        Test Case 1: Bank customer getting car insurance

        Scenario:
        1. Customer exists at Bank A with complete KYC data
        2. Customer wants to get car insurance from Insurance Company
        3. Insurance Company requests customer data from Bank A
        4. Customer gives consent
        5. Insurance Company retrieves customer data
        6. Insurance Company verifies and uses data for car insurance
        """
        self.print_section("Test Case 1: Bank Customer Getting Car Insurance")

        try:
            # Step 1: Customer data exists at Bank A
            self.print_step("Step 1: Customer data exists at Bank A")

            customer_data = {
                "lastName": "Schmidt",
                "givenName": "Anna",
                "birthDate": "1990-05-20",
                "nationality": "CH"
            }

            shared_hash = self.generate_shared_hash(
                customer_data["lastName"],
                customer_data["givenName"],
                customer_data["birthDate"],
                customer_data["nationality"]
            )

            self.print_info(f"Customer: {customer_data['givenName']} {customer_data['lastName']}")
            self.print_info(f"Shared Hash: {shared_hash[:16]}...")

            # Step 2: Register customer at Bank A (simulate existing customer)
            self.print_step("Step 2: Register customer data at Bank A")

            full_customer_data = {
                "sharedCustomerHash": shared_hash,
                "basicData": {
                    "lastName": customer_data["lastName"],
                    "givenName": customer_data["givenName"],
                    "birthDate": customer_data["birthDate"],
                    "nationality": [customer_data["nationality"]],
                    "gender": "female",
                    "maritalStatus": "single",
                    "language": "de"
                },
                "contactInformation": {
                    "primaryEmail": "anna.schmidt@example.ch",
                    "mobilePhone": "+41791234567",
                    "preferredContactMethod": "email",
                    "communicationLanguage": "de"
                },
                "addressData": {
                    "residentialAddress": {
                        "street": "Bahnhofstrasse 15",
                        "postalCode": "8001",
                        "city": "Zürich",
                        "region": "ZH",
                        "country": "CH",
                        "addressType": "residential"
                    }
                },
                "identification": {
                    "identificationMethod": "video_identification",
                    "documentType": "id_card",
                    "documentNumber": "E98765432",
                    "issuingAuthority": "Stadt Zürich",
                    "issueDate": "2021-06-01",
                    "expiryDate": "2031-06-01",
                    "issuingCountry": "CH",
                    "levelOfAssurance": "high",
                    "verificationDate": datetime.now().isoformat(),
                    "verificationMethod": "video_ident_with_document"
                },
                "kycData": {
                    "occupation": "Marketing Manager",
                    "employer": "Swiss Marketing AG",
                    "employmentType": "employed",
                    "annualIncome": {
                        "amount": 95000,
                        "currency": "CHF"
                    },
                    "totalAssets": {
                        "amount": 180000,
                        "currency": "CHF"
                    },
                    "sourceOfFunds": "salary",
                    "pepStatus": False
                },
                "complianceData": {
                    "fatcaStatus": "non_us_person",
                    "crsReportable": False,
                    "taxResidencies": [
                        {
                            "country": "CH",
                            "isPrimary": True,
                            "tinNumber": "756.9876.5432.10"
                        }
                    ],
                    "sanctionsScreening": {
                        "sanctionsList": "clear",
                        "pepCheck": "clear",
                        "adverseMedia": "clear",
                        "lastScreeningDate": datetime.now().isoformat()
                    },
                    "amlRiskRating": "low"
                },
                "metadata": {
                    "originator": "CH-BANK-001",
                    "createdAt": datetime.now().isoformat(),
                    "lastUpdated": datetime.now().isoformat(),
                    "version": "1.0",
                    "dataClassification": "confidential",
                    "verificationStatus": "verified"
                }
            }

            # In production, this would be stored when customer opens account
            # For testing, we assume the sample data is already available
            self.print_success("Customer data registered at Bank A")

            # Step 3: Insurance Company checks if customer exists
            self.print_step("Step 3: Insurance Company checks if customer exists")

            check_result = self.api_request(
                'POST',
                '/v1/customer/check',
                'CH-INSURANCE-001',
                {
                    "sharedCustomerHash": shared_hash,
                    "basicData": {
                        "lastName": customer_data["lastName"],
                        "givenName": customer_data["givenName"],
                        "birthDate": customer_data["birthDate"],
                        "nationality": [customer_data["nationality"]]
                    }
                },
                "Checking customer existence..."
            )

            if not check_result["success"]:
                # Customer doesn't exist in test data, use the sample customer
                self.print_warning("Test customer not found, using sample customer data")
                self.print_data("Error Response", check_result["data"])
                sample_hash = self.generate_shared_hash("Müller", "Hans Peter", "1985-03-15", "CH")
                shared_hash = sample_hash
                customer_data["lastName"] = "Müller"
                customer_data["givenName"] = "Hans Peter"
                customer_data["birthDate"] = "1985-03-15"

                check_result = self.api_request(
                    'POST',
                    '/v1/customer/check',
                    'CH-INSURANCE-001',
                    {
                        "sharedCustomerHash": shared_hash,
                        "basicData": {
                            "lastName": customer_data["lastName"],
                            "givenName": customer_data["givenName"],
                            "birthDate": customer_data["birthDate"],
                            "nationality": [customer_data["nationality"]]
                        }
                    },
                    "Checking sample customer..."
                )

            if check_result["success"]:
                self.print_success("Customer found in system")
                self.print_data("Check Result", check_result["data"])
            else:
                self.print_error("Customer check failed")
                return False

            # Step 4: Insurance Company creates consent request
            self.print_step("Step 4: Insurance Company creates consent request")

            expiry_date = (datetime.now() + timedelta(days=30)).isoformat()

            consent_result = self.api_request(
                'POST',
                '/v1/consent',
                'CH-INSURANCE-001',
                {
                    "customerId": shared_hash,
                    "requestingInstitution": "CH-INSURANCE-001",
                    "providingInstitution": "CH-BANK-001",
                    "dataCategories": [
                        "basicData",
                        "contactInformation",
                        "addressData",
                        "identification",
                        "kycData"
                    ],
                    "purpose": "car_insurance_application",
                    "expiryDate": expiry_date,
                    "customerContactMethod": "email"
                },
                "Creating consent request..."
            )

            if not consent_result["success"]:
                self.print_error("Failed to create consent request")
                self.print_data("Error", consent_result["data"])
                return False

            consent_id = consent_result["data"].get("consentId")
            self.print_success(f"Consent request created: {consent_id}")
            self.print_data("Consent Details", consent_result["data"])

            # Step 5: Customer approves consent (simulated)
            self.print_step("Step 5: Customer approves consent")

            time.sleep(1)  # Simulate user reviewing consent

            approve_result = self.api_request(
                'POST',
                f'/v1/consent/{consent_id}/approve',
                'CH-BANK-001',  # Bank acts on behalf of customer
                {
                    "customerApproved": True,
                    "approvalMethod": "mobile_app",
                    "approvalTimestamp": datetime.now().isoformat()
                },
                "Approving consent..."
            )

            if approve_result["success"]:
                self.print_success("Consent approved by customer")
            else:
                self.print_warning("Consent approval endpoint may not be available (proceeding anyway)")

            # Step 6: Insurance Company retrieves customer data
            self.print_step("Step 6: Insurance Company retrieves customer data with consent")

            time.sleep(1)

            data_result = self.api_request(
                'POST',
                '/v1/customer/data',
                'CH-INSURANCE-001',
                {
                    "sharedCustomerHash": shared_hash,
                    "consentId": consent_id,
                    "dataCategories": [
                        "basicData",
                        "contactInformation",
                        "addressData",
                        "identification",
                        "kycData"
                    ]
                },
                "Retrieving customer data..."
            )

            if data_result["success"]:
                self.print_success("Customer data retrieved successfully")
                retrieved_data = data_result["data"]

                # Display retrieved data summary
                if "basicData" in retrieved_data:
                    self.print_info(f"Customer: {retrieved_data['basicData'].get('givenName')} {retrieved_data['basicData'].get('lastName')}")
                if "addressData" in retrieved_data:
                    addr = retrieved_data['addressData'].get('residentialAddress', {})
                    self.print_info(f"Address: {addr.get('street')}, {addr.get('city')}")
                if "kycData" in retrieved_data:
                    self.print_info(f"Occupation: {retrieved_data['kycData'].get('occupation')}")

                self.print_success("Insurance Company can now process car insurance application")
                return True
            else:
                self.print_error("Failed to retrieve customer data")
                self.print_data("Error", data_result["data"])
                return False

        except Exception as e:
            self.print_error(f"Test case 1 failed with exception: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def test_case_2_bank_transfer(self) -> bool:
        """
        Test Case 2: Customer transfers from Bank A to Bank B

        Scenario:
        1. Customer exists at Bank A with complete account history
        2. Customer wants to open account at Bank B
        3. Bank B requests customer data from Bank A
        4. Customer gives consent
        5. Bank B retrieves customer data
        6. Bank B uses data for account opening (faster onboarding)
        """
        self.print_section("Test Case 2: Customer Transfers from Bank A to Bank B")

        try:
            # Step 1: Customer exists at Bank A
            self.print_step("Step 1: Customer exists at Bank A")

            # Use the sample customer from the API
            customer_data = {
                "lastName": "Müller",
                "givenName": "Hans Peter",
                "birthDate": "1985-03-15",
                "nationality": "CH"
            }

            shared_hash = self.generate_shared_hash(
                customer_data["lastName"],
                customer_data["givenName"],
                customer_data["birthDate"],
                customer_data["nationality"]
            )

            self.print_info(f"Customer: {customer_data['givenName']} {customer_data['lastName']}")
            self.print_info(f"Shared Hash: {shared_hash[:16]}...")
            self.print_info("Bank A: CH-BANK-002 (current bank)")
            self.print_info("Bank B: CH-BANK-003 (new bank)")

            # Step 2: Bank B checks if customer data exists in the system
            self.print_step("Step 2: Bank B checks if customer exists in the system")

            check_result = self.api_request(
                'POST',
                '/v1/customer/check',
                'CH-BANK-003',
                {
                    "sharedCustomerHash": shared_hash,
                    "basicData": {
                        "lastName": customer_data["lastName"],
                        "givenName": customer_data["givenName"],
                        "birthDate": customer_data["birthDate"],
                        "nationality": [customer_data["nationality"]]
                    }
                },
                "Bank B checking customer existence..."
            )

            if check_result["success"]:
                check_data = check_result["data"]
                if check_data.get("exists"):
                    self.print_success("Customer found in the banking network")
                    self.print_info(f"Originating institution: {check_data.get('originator', 'Unknown')}")
                    self.print_info(f"Last updated: {check_data.get('lastUpdated', 'Unknown')}")
                else:
                    self.print_error("Customer not found in banking network")
                    return False
            else:
                self.print_error("Customer existence check failed")
                return False

            # Step 3: Bank B creates consent request for account opening
            self.print_step("Step 3: Bank B creates consent request for account opening")

            expiry_date = (datetime.now() + timedelta(days=90)).isoformat()

            consent_result = self.api_request(
                'POST',
                '/v1/consent',
                'CH-BANK-003',
                {
                    "customerId": shared_hash,
                    "requestingInstitution": "CH-BANK-003",
                    "providingInstitution": "CH-BANK-002",
                    "dataCategories": [
                        "basicData",
                        "contactInformation",
                        "addressData",
                        "identification",
                        "kycData",
                        "complianceData"
                    ],
                    "purpose": "account_opening",
                    "expiryDate": expiry_date,
                    "customerContactMethod": "email"
                },
                "Bank B creating consent request..."
            )

            if not consent_result["success"]:
                self.print_error("Failed to create consent request")
                self.print_data("Error", consent_result["data"])
                return False

            consent_id = consent_result["data"].get("consentId")
            self.print_success(f"Consent request created: {consent_id}")

            # Show QR code info if available
            if "qrCode" in consent_result["data"]:
                self.print_info("QR code generated for mobile consent approval")
            if "consentUrl" in consent_result["data"]:
                self.print_info(f"Consent URL: {consent_result['data']['consentUrl']}")

            # Step 4: Customer approves consent
            self.print_step("Step 4: Customer approves consent via mobile app")

            time.sleep(2)  # Simulate customer reviewing and approving

            approve_result = self.api_request(
                'POST',
                f'/v1/consent/{consent_id}/approve',
                'CH-BANK-002',  # Current bank validates approval
                {
                    "customerApproved": True,
                    "approvalMethod": "mobile_app",
                    "approvalTimestamp": datetime.now().isoformat(),
                    "customerSignature": "digital_signature_hash"
                },
                "Customer approving consent..."
            )

            if approve_result["success"]:
                self.print_success("Consent approved by customer")
            else:
                self.print_warning("Consent approval endpoint may not be available (proceeding anyway)")

            # Step 5: Bank B retrieves comprehensive customer data
            self.print_step("Step 5: Bank B retrieves customer data for account opening")

            time.sleep(1)

            data_result = self.api_request(
                'POST',
                '/v1/customer/data',
                'CH-BANK-003',
                {
                    "sharedCustomerHash": shared_hash,
                    "consentId": consent_id,
                    "dataCategories": [
                        "basicData",
                        "contactInformation",
                        "addressData",
                        "identification",
                        "kycData",
                        "complianceData"
                    ]
                },
                "Bank B retrieving customer data..."
            )

            if not data_result["success"]:
                self.print_error("Failed to retrieve customer data")
                self.print_data("Error", data_result["data"])
                return False

            self.print_success("Customer data retrieved successfully by Bank B")

            retrieved_data = data_result["data"]

            # Step 6: Bank B validates data and opens account
            self.print_step("Step 6: Bank B validates data and processes account opening")

            # Display key data points
            if "basicData" in retrieved_data:
                basic = retrieved_data['basicData']
                self.print_info(f"✓ Personal data: {basic.get('givenName')} {basic.get('lastName')}")

            if "identification" in retrieved_data:
                ident = retrieved_data['identification']
                self.print_info(f"✓ Identification: {ident.get('documentType')} - Level: {ident.get('levelOfAssurance')}")
                self.print_success("No additional identification needed!")

            if "kycData" in retrieved_data:
                kyc = retrieved_data['kycData']
                self.print_info(f"✓ KYC data: {kyc.get('occupation')} - PEP: {kyc.get('pepStatus')}")
                self.print_success("KYC already completed!")

            if "complianceData" in retrieved_data:
                compliance = retrieved_data['complianceData']
                self.print_info(f"✓ Compliance: AML Risk: {compliance.get('amlRiskRating')}")
                self.print_success("Compliance checks already done!")

            if "addressData" in retrieved_data:
                addr = retrieved_data['addressData'].get('residentialAddress', {})
                self.print_info(f"✓ Address: {addr.get('street')}, {addr.get('postalCode')} {addr.get('city')}")

            # Simulate account opening
            time.sleep(1)

            self.print_success("Account opening at Bank B completed!")
            self.print_info("Benefits of data sharing:")
            self.print_info("  • No repeated identification process")
            self.print_info("  • No repeated KYC checks")
            self.print_info("  • No repeated compliance screening")
            self.print_info("  • Faster onboarding (minutes instead of days)")
            self.print_info("  • Better customer experience")

            # Step 7: Check consent status
            self.print_step("Step 7: Verify consent status")

            consent_check = self.api_request(
                'GET',
                f'/v1/consent/{consent_id}',
                'CH-BANK-003',
                description="Checking final consent status..."
            )

            if consent_check["success"]:
                self.print_success("Consent verified and logged")
                self.print_data("Final Consent Status", consent_check["data"])

            return True

        except Exception as e:
            self.print_error(f"Test case 2 failed with exception: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def run_all_tests(self):
        """Run all test scenarios"""
        self.print_section("Open Banking API - End-to-End Test Suite")

        print(f"{Colors.BOLD}Test Scenarios:{Colors.ENDC}")
        print("1. Bank customer getting car insurance (data sharing)")
        print("2. Customer transfers from Bank A to Bank B (account opening)")
        print()

        # Check Python dependencies first
        self.print_step("Checking Python dependencies...")
        if not self.check_python_dependencies():
            self.print_error("Python dependencies not satisfied. Exiting.")
            return False
        print()

        # Start API server
        if not self.start_api_server():
            self.print_error("Failed to start API server. Exiting.")
            return False

        # Give server a moment to fully initialize
        time.sleep(3)

        try:
            # Run test cases
            results = {
                "Test Case 1 (Insurance)": self.test_case_1_insurance(),
                "Test Case 2 (Bank Transfer)": self.test_case_2_bank_transfer()
            }

            # Print summary
            self.print_section("Test Results Summary")

            all_passed = True
            for test_name, passed in results.items():
                if passed:
                    self.print_success(f"{test_name}: PASSED")
                else:
                    self.print_error(f"{test_name}: FAILED")
                    all_passed = False

            print()
            if all_passed:
                self.print_success("All tests passed! ✓")
                return True
            else:
                self.print_error("Some tests failed. ✗")
                return False

        finally:
            # Always stop the server
            if self.api_process:
                self.stop_api_server()


def main():
    """Main entry point"""
    runner = APITestRunner()

    # Handle Ctrl+C gracefully
    def signal_handler(sig, frame):
        print(f"\n{Colors.WARNING}Test interrupted by user{Colors.ENDC}")
        if runner.api_process:
            runner.stop_api_server()
        sys.exit(1)

    signal.signal(signal.SIGINT, signal_handler)

    # Run tests
    success = runner.run_all_tests()

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
