package bulkresult

const MaxBatchSize = 500

type ItemResult struct {
	Index   int            `json:"index,omitempty"`
	ID      any            `json:"id,omitempty"`
	Success bool           `json:"success"`
	Error   string         `json:"error,omitempty"`
	Data    map[string]any `json:"data,omitempty"`
}

type Summary struct {
	Succeeded int          `json:"succeeded"`
	Failed    int          `json:"failed"`
	Skipped   int          `json:"skipped"`
	Results   []ItemResult `json:"results"`
}

func (s *Summary) AddSuccess(result ItemResult) {
	result.Success = true
	s.Succeeded++
	s.Results = append(s.Results, result)
}

func (s *Summary) AddFailure(result ItemResult, err string) {
	result.Success = false
	result.Error = err
	s.Failed++
	s.Results = append(s.Results, result)
}

func (s *Summary) AddSkipped(result ItemResult, err string) {
	result.Success = false
	result.Error = err
	s.Skipped++
	s.Results = append(s.Results, result)
}
