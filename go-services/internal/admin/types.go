package admin

type CleanupResult struct {
	Success                bool     `json:"success"`
	DeletedFromSuperTokens bool     `json:"deletedFromSuperTokens"`
	DeletedFromAppUsers    bool     `json:"deletedFromAppUsers"`
	DeletedRoleAssignments int      `json:"deletedRoleAssignments"`
	Errors                 []string `json:"errors"`
}
