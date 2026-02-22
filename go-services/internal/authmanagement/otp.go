package authmanagement

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

// GenerateOTP produces a random numeric OTP of the given length (4-6 digits).
func GenerateOTP(length int) (string, error) {
	if length < 4 {
		length = 4
	}
	if length > 6 {
		length = 6
	}

	min := intPow(10, length-1)
	max := intPow(10, length) - 1

	rangeSize := big.NewInt(int64(max - min + 1))
	n, err := rand.Int(rand.Reader, rangeSize)
	if err != nil {
		return "", fmt.Errorf("generate OTP: %w", err)
	}

	otp := int(n.Int64()) + min
	return fmt.Sprintf("%0*d", length, otp), nil
}

func intPow(base, exp int) int {
	result := 1
	for i := 0; i < exp; i++ {
		result *= base
	}
	return result
}
