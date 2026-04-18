import axios from 'axios';

const API_BASE_URL = 'https://api.jotform.com';

// Form IDs
export const FORM_IDS = {
    checkins: '261065067494966',
    messages: '261065765723966',
    sightings: '261065244786967',
    personalNotes: '261065509008958',
    anonymousTips: '261065875889981'
};

// API Keys from environment variables or defaults (for development)
const API_KEYS = [
    process.env.REACT_APP_JOTFORM_API_KEY_1 || 'ad39735f1449a6dc28d60e0921352665',
    process.env.REACT_APP_JOTFORM_API_KEY_2 || '54a934fa20b1ccc3a5bd1d2076f90556',
    process.env.REACT_APP_JOTFORM_API_KEY_3 || '5593acd695caab1a3805c3af8532df09'
].filter(Boolean);

/**
 * Fetch submissions from a Jotform with retry logic
 * @param {string} formId - The form ID
 * @param {number} apiKeyIndex - Index of the API key to use (0-2)
 * @param {number} retries - Number of retries (default 0)
 * @returns {Promise<Array>} Array of form submissions
 */
export const getFormSubmissions = async (formId, apiKeyIndex = 0, retries = 0) => {
    try {
        if (API_KEYS.length === 0) {
            throw new Error('No API keys configured. Please add them to .env file');
        }

        const apiKey = API_KEYS[apiKeyIndex % API_KEYS.length];
        const response = await axios.get(
            `${API_BASE_URL}/form/${formId}/submissions?apiKey=${apiKey}`,
            { timeout: 10000 }
        );

        if (response.data.responseCode === 200) {
            return response.data.content || [];
        }

        // Check for API limit exceeded
        if (response.data.responseCode === 401 || response.data.message?.includes('limit')) {
            throw new Error(`API Limit Exceeded: ${response.data.message}. Please get new API keys from jotform.com`);
        }

        throw new Error(`API Error: ${response.data.message}`);
    } catch (error) {
        // Retry with next API key if available
        if (retries < API_KEYS.length - 1) {
            console.warn(`Retrying with next API key... (${retries + 1}/${API_KEYS.length - 1})`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            return getFormSubmissions(formId, apiKeyIndex + 1, retries + 1);
        }

        console.error(`Error fetching submissions for form ${formId}:`, error.message);
        throw error;
    }
};

/**
 * Fetch all form submissions across all forms
 * @returns {Promise<Object>} Object with submissions for each form
 */
export const getAllFormSubmissions = async () => {
    try {
        const submissions = {};
        let apiKeyIndex = 0;

        for (const [formName, formId] of Object.entries(FORM_IDS)) {
            try {
                submissions[formName] = await getFormSubmissions(formId, apiKeyIndex);
                apiKeyIndex++;
            } catch (error) {
                console.error(`Failed to fetch ${formName}:`, error.message);
                submissions[formName] = [];
            }
        }

        return submissions;
    } catch (error) {
        console.error('Error fetching all submissions:', error.message);
        throw error;
    }
};

/**
 * Fetch a single form's data
 * @param {string} formName - Name of the form (key from FORM_IDS)
 * @returns {Promise<Object>} Form data with submissions
 */
export const getFormData = async (formName) => {
    try {
        const formId = FORM_IDS[formName];
        if (!formId) {
            throw new Error(`Unknown form: ${formName}`);
        }

        const submissions = await getFormSubmissions(formId, 0);
        return {
            formName,
            formId,
            submissions,
            submissionCount: submissions.length
        };
    } catch (error) {
        console.error(`Error fetching data for ${formName}:`, error.message);
        throw error;
    }
};
