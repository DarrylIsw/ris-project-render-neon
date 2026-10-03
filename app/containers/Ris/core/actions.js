import {
  RIS_API_FAILURE,
  RIS_API_REQUEST,
  RIS_API_SUCCESS,
  RIS_ENDPOINTS,
} from './constants';

export const risApiRequest = key => ({ type: RIS_API_REQUEST, key });
export const risApiSuccess = (key, payload) => ({ type: RIS_API_SUCCESS, key, payload });
export const risApiFailure = (key, error) => ({ type: RIS_API_FAILURE, key, error });

export const fetchRisEndpoint = key => async dispatch => {
  dispatch(risApiRequest(key));
  try {
    const response = await fetch(RIS_ENDPOINTS[key]);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Gagal mengambil data RIS.');
    dispatch(risApiSuccess(key, payload));
    return payload;
  } catch (error) {
    dispatch(risApiFailure(key, error.message));
    throw error;
  }
};
