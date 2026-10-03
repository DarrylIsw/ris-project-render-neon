import {
  RIS_API_FAILURE,
  RIS_API_REQUEST,
  RIS_API_SUCCESS,
} from './constants';

const initialState = {
  loading: {},
  errors: {},
  records: {},
};

export default function risReducer(state = initialState, action = {}) {
  switch (action.type) {
    case RIS_API_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, [action.key]: true },
        errors: { ...state.errors, [action.key]: null },
      };
    case RIS_API_SUCCESS:
      return {
        ...state,
        loading: { ...state.loading, [action.key]: false },
        records: { ...state.records, [action.key]: action.payload },
      };
    case RIS_API_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, [action.key]: false },
        errors: { ...state.errors, [action.key]: action.error },
      };
    default:
      return state;
  }
}
