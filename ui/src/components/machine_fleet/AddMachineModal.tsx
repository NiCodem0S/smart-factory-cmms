import { use, useState } from "react";
import ReactDOM from "react-dom"
import { useForm, SubmitHandler } from "react-hook-form"
import { MachineStatus, CreateMachineDto } from "../../types/machine";
import useCreateMachine from "../../hooks/useCreateMachine";

export default function AddMachineModal() {

    const [isOpen, setIsOpen] = useState(false);
    const { execute, isLoading, error } = useCreateMachine();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreateMachineDto>()

    const handleFormSubmit: SubmitHandler<CreateMachineDto> = async (dto) => {
        try {
            await execute(dto);
            reset();
            setIsOpen(false);
        }
        catch (err) {

        }
    }

    return (
        <div>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded">Open
            </button>
            <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since 1966, when designers at Letraset and James Mosley, the librarian at St Bride Printing Library in London, took a 1914 Cicero translation and scrambled it to make dummy text for Letraset's Body Type sheets. It has survived not only many decades, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised thanks to these sheets and more recently with desktop publishing software like Aldus PageMaker and Microsoft Word including versions of Lorem Ipsum.
                Why do we use it?
                It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).</p>

            {isOpen && (
                <div className="fixed inset-0 bg-gray-100/75 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-[500px]">
                        <h2 className="text-2xl font-bold mb-4">
                            Add Machine
                        </h2>

                        <form onSubmit={handleSubmit(handleFormSubmit)}>
                            <label>Name: </label>
                            <input type="text" {...register("name", { required: true, maxLength: 255 })} className="bg-gray-100" />
                            <label>Category:</label>
                            <input type="text" {...register("category", { required: true, maxLength: 127 })} className="bg-gray-100" />
                            <label>Serial Number:</label>
                            <input type="text" {...register("serialNumber", { required: true, maxLength: 127 })} className="bg-gray-100" />
                            <label>Status: </label>
                            <select {...register("status")} className="bg-gray-100">
                                <option value="Running">Running</option>
                                <option value="Offline">Offline</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Error">Error</option>
                            </select>
                            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-500 text-white rounded" />
                        </form>

                    </div>
                </div>
            )}
            {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm mb-3">
                    {error}
                </div>
            )}


        </div>
    )
}