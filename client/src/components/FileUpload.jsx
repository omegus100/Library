import { FilePond, registerPlugin } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';

// Register the FilePond plugin
registerPlugin(FilePondPluginImagePreview);

const FileUploader = ({ files, onUpdateFiles }) => (
    <>
        <label htmlFor="cover">Cover Image:</label>
        <FilePond
            files={files ? [{ source: files }] : []}
            onupdatefiles={onUpdateFiles}
            allowMultiple={false}
            maxFiles={1}
            name="cover"
            labelIdle='Drag & Drop your cover image or <span class="filepond--label-action">Browse</span>'
        />
    </>
);

export default FileUploader;